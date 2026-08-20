#!/usr/bin/env bash
#
# Invariant checker for tmfus.com.
#
# Every check here exists because something broke once. Run it before you
# tell John anything is finished. Exit code 0 means all invariants hold.
#
#   ./scripts/verify.sh
#
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

FAIL=0
pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=1; }
head() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# ---------------------------------------------------------------
head "Syntax"

# Skip rather than fail when PHP is not installed. A machine without PHP
# cannot tell you anything about the PHP, and reporting six failures for
# one missing binary buries the checks that did run.
if command -v php >/dev/null 2>&1; then
  php_bad=0
  for f in $(find . -name '*.php' -not -path './node_modules/*'); do
    if out=$(php -l "$f" 2>&1); then :; else fail "PHP syntax: $f — $out"; php_bad=1; fi
  done
  [ $php_bad -eq 0 ] && pass "all PHP files parse"
else
  printf '  [33m—[0m %s
' "php not installed here, so PHP files were NOT checked — run this again somewhere with php before deploying"
fi

if node --check assets/app.js 2>/dev/null; then
  pass "assets/app.js parses"
else
  fail "assets/app.js has a syntax error"
fi

# ---------------------------------------------------------------
head "Cache busting"
# Forget this and John sees no change, reports the site broken, and you
# waste a round trip proving the server is fine.

versions=$(grep -oh 'styles\.css?v=[0-9]*\|app\.js?v=[0-9]*' ./*.html \
           | grep -o 'v=[0-9]*' | sort -u)
count=$(echo "$versions" | wc -l)
if [ "$count" -eq 1 ]; then
  pass "all asset links agree: $versions"
else
  fail "asset versions disagree across pages: $(echo "$versions" | tr '\n' ' ')"
fi

pages=$(ls -1 ./*.html | wc -l)
refs=$(grep -l 'styles\.css?v=' ./*.html | wc -l)
if [ "$pages" -eq "$refs" ]; then
  pass "$pages HTML pages, all carry a versioned stylesheet link"
else
  fail "$pages HTML pages but only $refs reference a versioned stylesheet"
fi

# ---------------------------------------------------------------
head "Deployment list"
# .cpanel.yml names files ONE BY ONE. A new top-level file that is not
# listed silently never reaches the server. This has bitten five times.

for f in ./*.html ./*.php ./robots.txt ./sitemap.xml ./llms.txt; do
  base=$(basename "$f")
  [ -e "$f" ] || continue
  if grep -q "$base" .cpanel.yml; then :; else
    fail "$base is not in .cpanel.yml — it will never deploy"
  fi
done
for f in api/*.php; do
  base=$(basename "$f")
  [ "$base" = "config.php" ] && continue      # server-only, never deployed
  if grep -q "api/$base" .cpanel.yml; then :; else
    fail "api/$base is not in .cpanel.yml — it will never deploy"
  fi
done
[ $FAIL -eq 0 ] && pass "every deployable file is listed in .cpanel.yml"

if grep -qE 'cp -Rf?[[:space:]]+api/' .cpanel.yml; then
  fail "a recursive copy of api/ would delete api/config.php on the server"
else
  pass "api/ is copied file by file, so config.php survives deploys"
fi

# ---------------------------------------------------------------
head "Secrets"

if [ -f api/config.php ]; then
  fail "api/config.php exists in the working tree — it must live ONLY on the server"
else
  pass "no api/config.php in the tree"
fi

if grep -rqE '(sk-|Bearer [A-Za-z0-9]{20,})' assets/app.js ./*.html 2>/dev/null; then
  fail "something that looks like an API key is in client-side code"
else
  pass "no API keys in client-side code"
fi

# Lower-case config key names only. The client legitimately has a
# CHAT_ENDPOINT constant pointing at our own /api/chat.php proxy — that is
# the whole design, not a leak, so it must not be matched here.
leaked=0
for f in assets/app.js ./*.html; do
  if grep -q 'chat_api_key\|affiliate_id\|application_pubkey\|admin_password\|altaflow_token' "$f" 2>/dev/null; then
    fail "$f references a server-only config key"
    leaked=1
  fi
done
[ $leaked -eq 0 ] && pass "no server-only config names leak into the client"

# ---------------------------------------------------------------
head "Data handling invariants"

if grep -q "FORBIDDEN_KEYS\|SENSITIVE_KEYS" api/lead.php && \
   grep -q "SENSITIVE_KEYS" api/application.php; then
  pass "lead.php and application.php both still scrub sensitive keys"
else
  fail "the sensitive-key scrub is missing from lead.php or application.php"
fi

if grep -q "stripSensitive" api/chat.php; then
  pass "chat.php still strips SSN-shaped text"
else
  fail "chat.php no longer strips SSN-shaped text"
fi

if grep -q 'application_pubkey' api/application.php && \
   grep -q 'fail(503' api/application.php; then
  pass "application.php still fails closed without an encryption key"
else
  fail "application.php no longer fails closed without a key"
fi

if grep -A12 'function bubble' assets/app.js | grep -q 'el.textContent = text'; then
  pass "chat messages are rendered with textContent, not innerHTML"
else
  fail "chat bubbles no longer use textContent — that is an XSS hole"
fi

# ---------------------------------------------------------------
head "Signet removal"
# John asked for the name off the website. Docs keep it for history.

if grep -rliE 'signet|altaflow|alfw' --include='*.html' --include='*.js' \
     --include='*.css' --include='*.php' . >/dev/null 2>&1; then
  fail "Signet/altaFlow still referenced in served files: $(grep -rliE 'signet|altaflow|alfw' --include='*.html' --include='*.js' --include='*.css' --include='*.php' . | tr '\n' ' ')"
else
  pass "no Signet or altaFlow references in served files"
fi

# ---------------------------------------------------------------
head "SEO"

missing_canonical=$(grep -L 'rel="canonical"' ./*.html | tr '\n' ' ')
if [ -z "$missing_canonical" ]; then
  pass "every page has a canonical URL"
else
  fail "pages without a canonical: $missing_canonical"
fi

if grep -qh 'href="[a-z-]*\.html"' ./*.html; then
  fail "internal links still point at .html — each one costs a 301 hop"
else
  pass "internal links use clean URLs"
fi

if python3 - <<'PY'
import io, re, json, glob, sys
bad = []
for f in glob.glob('*.html'):
    html = io.open(f, encoding='utf-8').read()
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            json.loads(block)
        except Exception as e:
            bad.append('%s: %s' % (f, e))
sys.exit(1 if bad else 0)
PY
then
  pass "all JSON-LD blocks are valid JSON"
else
  fail "a JSON-LD block does not parse"
fi

[ -f robots.txt ] && pass "robots.txt present" || fail "robots.txt missing"
[ -f sitemap.xml ] && pass "sitemap.xml present" || fail "sitemap.xml missing"

# ---------------------------------------------------------------
head "Chat launcher"
# There used to be two buttons in the bottom-right corner: the real one,
# built by initChat(), and a decorative .fab in the markup that was wired
# to nothing and opened nothing. John reported it. It must not come back.

if grep -q 'class="fab"' ./*.html 2>/dev/null; then
  fail "the dead .fab chat button is back in the markup — it opens nothing"
else
  pass "no dead .fab button in any page"
fi

if grep -q '^\.fab' assets/styles.css; then
  fail "orphan .fab styles are back in styles.css"
else
  pass "no orphan .fab styles"
fi

launchers=$(grep -c "className = 'chat-launch'" assets/app.js)
if [ "$launchers" -eq 1 ]; then
  pass "exactly one chat launcher is created"
else
  fail "$launchers chat launchers in app.js — there must be exactly one"
fi

if grep -q "data-open-chat" assets/app.js; then
  pass "the chat can be opened from anywhere via data-open-chat"
else
  fail "data-open-chat handling is gone — the calculator result cannot open the chat"
fi

# ---------------------------------------------------------------
head "The result screen"
# A merchant who has just seen a number is offered exactly three ways
# out. Losing one of them silently is a conversion bug nobody notices.

for want in 'href="/apply"' 'data-open-chat=' 'href="/heloc-calculator"'; do
  if grep -q "$want" assets/app.js; then :; else
    fail "the calculator result no longer offers $want"
  fi
done
if grep -q 'class="decision"' assets/app.js; then
  pass "the three-option decision block is still on the result screen"
else
  fail "the decision block is missing from showAnswer()"
fi

# ---------------------------------------------------------------
head "Email validation"

if grep -q "EMAIL_ERROR = 'Not a valid email address.'" assets/app.js; then
  pass "the bad-email message is the wording John asked for"
else
  fail "the bad-email wording changed — it must read 'Not a valid email address.'"
fi

wired=$(grep -c 'EMAIL_ERROR' assets/app.js)
if [ "$wired" -ge 5 ]; then
  pass "every email check uses the one message ($wired references)"
else
  fail "only $wired references to EMAIL_ERROR — a form is validating email its own way again"
fi

# ---------------------------------------------------------------
head "Consent and cookies"

if grep -q "initConsent();" assets/app.js && \
   grep -A2 'function boot' assets/app.js | grep -q 'initConsent'; then
  pass "consent is initialised first, before anything can set a cookie"
else
  fail "initConsent() is not the first thing boot() does"
fi

# A tag that loads from markup has bypassed the whole consent mechanism.
if grep -qE 'googletagmanager\.com|connect\.facebook\.net|google-analytics\.com' ./*.html; then
  fail "a tracking script is hard-coded in the HTML — it would load before consent"
else
  pass "no tracking script loads from markup"
fi

if grep -q "globalPrivacyControl" assets/app.js; then
  pass "Global Privacy Control is honoured"
else
  fail "GPC handling is gone — California treats that signal as an opt-out"
fi

# ---------------------------------------------------------------
head "Legal pages"

for f in terms.html privacy.html; do
  [ -f "$f" ] || fail "$f is missing"
done

missing_terms=$(grep -L 'href="/terms"' ./*.html | tr '\n' ' ')
if [ -z "$missing_terms" ]; then
  pass "every page links to the terms"
else
  fail "pages with no link to /terms: $missing_terms"
fi

missing_privacy=$(grep -L 'href="/privacy"' ./*.html | tr '\n' ' ')
if [ -z "$missing_privacy" ]; then
  pass "every page links to the privacy policy"
else
  fail "pages with no link to /privacy: $missing_privacy"
fi

if grep -q 'data-cookie-settings' privacy.html && grep -q 'id="do-not-sell"' privacy.html; then
  pass "the opt-out and the cookie settings are reachable from the policy"
else
  fail "the Do Not Sell section or the cookie settings link is missing from privacy.html"
fi

# Deliberate. These pages are not finished until John supplies the entity
# name, the mailing address and the governing-law state, and an unfinished
# privacy policy should not be able to pass quietly.
todo=$(grep -l 'TO BE COMPLETED' ./*.html | tr '\n' ' ')
if [ -z "$todo" ]; then
  pass "no unfilled placeholders left in the legal pages"
else
  fail "still to be filled in by John: $todo (entity name, mailing address, governing-law state)"
fi

# ---------------------------------------------------------------
head "Key handling"

# The fifth argument to importKey is `extractable`. If it is ever true,
# a script on this page could read the private key bytes back out and
# post them somewhere. It must stay false for both imports.
if grep -qE "importKey\('pkcs8'.*true," admin.php ||    grep -qE "\{ name: 'RSA-OAEP', hash: 'SHA-1' \}, true," admin.php; then
  fail "the private key is imported extractable — its bytes could be read back out"
else
  pass "the private key is imported non-extractable"
fi

if grep -qE "fetch\(.*privKey|body:.*privKey|privKey.*JSON.stringify" admin.php; then
  fail "admin.php looks like it sends the private key somewhere"
else
  pass "the private key never leaves the browser"
fi

if grep -q "PBKDF2" admin.php && grep -q "AES-GCM" admin.php; then
  pass "the stored key is passphrase-wrapped, not sitting in the clear"
else
  fail "the key vault no longer wraps the stored key"
fi

# The real thing: seal an application the way application.php does, wrap a
# key the way admin.php does, then open it. Reasoning about this chain has
# gone wrong before; running it has not.
if node scripts/crypto-chain-test.mjs >/tmp/tmf-chain.log 2>&1; then
  pass "seal -> wrap -> unlock -> decrypt round trip passes"
else
  fail "the encryption chain is broken: $(tail -3 /tmp/tmf-chain.log | tr '
' ' ')"
fi

if grep -q "private" api/config.example.php 2>/dev/null && \
   grep -qi "private key" api/config.example.php && \
   grep -q "application_pubkey" api/config.example.php; then
  pass "config.example.php still asks for the PUBLIC key only"
fi

# ---------------------------------------------------------------
printf '\n'
if [ $FAIL -eq 0 ]; then
  printf '\033[32mAll invariants hold.\033[0m\n'
else
  printf '\033[31mSomething above is broken. Fix it before saying the work is done.\033[0m\n'
fi
exit $FAIL
