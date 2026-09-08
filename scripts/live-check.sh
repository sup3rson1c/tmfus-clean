#!/usr/bin/env bash
#
# Deploy-drift checker for tmfus.com.
#
# verify.sh answers "is the code in this folder correct?".
# This answers the different, and repeatedly more expensive, question:
# "is the code in this folder actually the code that is running?"
#
# It exists because on 8 September 2026 the opt-out page went live while
# api/unsubscribe.php did not. The page rendered, the form posted into
# nothing, and the site looked healthy from every angle except the one that
# mattered. A working site is not evidence that the deploy is current.
#
#   ./scripts/live-check.sh                  # against https://tmfus.com
#   ./scripts/live-check.sh https://staging  # against anywhere else
#
# Exit code 0 means the server is serving what this folder contains.
#
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

SITE="${1:-https://tmfus.com}"
SITE="${SITE%/}"
CURL="curl -s --max-time 25"

FAIL=0
pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=1; }
warn() { printf '  \033[33m—\033[0m %s\n' "$1"; }
sect() { printf '\n\033[1m%s\033[0m\n' "$1"; }

printf '\033[1mChecking %s against this working copy\033[0m\n' "$SITE"

# ---------------------------------------------------------------
sect "Reachable"

root_code=$($CURL -o /dev/null -w '%{http_code}' "$SITE/")
if [ "$root_code" = "200" ]; then
  pass "the site answers ($root_code)"
else
  fail "the site returned $root_code — everything below is meaningless, stop here"
  exit 1
fi

# ---------------------------------------------------------------
sect "Asset version"

# The number the browser is actually being told to fetch. This is the truth;
# what any note or changelog claims is not.
live_v=$($CURL "$SITE/" | grep -o 'app\.js?v=[0-9]*' | head -1 | grep -o '[0-9]*')
local_v=$(grep -oh 'app\.js?v=[0-9]*' ./*.html | grep -o '[0-9]*' | sort -u | head -1)

if [ -z "$live_v" ]; then
  fail "no versioned app.js link on the served homepage"
elif [ "$live_v" = "$local_v" ]; then
  pass "served and local agree at v=$live_v"
else
  fail "served v=$live_v but this folder is v=$local_v — the deploy is behind (or ahead)"
fi

# ---------------------------------------------------------------
sect "Assets byte-for-byte"

# Compare contents, not byte counts. A raw byte count is the obvious check
# and it lies: assets/styles.css is CRLF in this folder and LF on the server,
# so it reads as 1,766 bytes stale on every run while being character for
# character the same file. Normalise the line endings, then compare — and
# report the line-ending drift separately, because it is worth knowing and
# is not a reason to redeploy.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for a in assets/app.js assets/styles.css; do
  [ -f "$a" ] || { warn "$a is not in this folder"; continue; }
  $CURL "$SITE/$a" > "$tmp/served"
  if [ ! -s "$tmp/served" ]; then
    fail "$a: the server returned nothing"
    continue
  fi
  if cmp -s "$tmp/served" "$a"; then
    pass "$a matches exactly ($(wc -c < "$a" | tr -d ' ') bytes)"
  elif diff -q --strip-trailing-cr "$tmp/served" "$a" >/dev/null; then
    pass "$a matches (line endings differ only — this folder is CRLF, the server is LF)"
  else
    fail "$a: the server is serving different content ($(wc -c < "$tmp/served" | tr -d ' ') bytes vs $(wc -c < "$a" | tr -d ' ') here) — deploy it"
  fi
done

# ---------------------------------------------------------------
sect "Every file .cpanel.yml claims to deploy"

# Read the deploy list rather than a hand-kept list here, so a file added to
# the deployment cannot be added without also being checked.
deployed=$(grep -o 'cp -f [^ ]*' .cpanel.yml | awk '{print $3}' | grep -v '^\.htaccess$')

# THE TRAP THIS SCRIPT WAS WRITTEN FOR.
# On this host a missing .php under /api/ returns 500, not 404. A 500 reads
# as "the code is broken" and sends you into the source for an hour. The
# giveaway is the x-powered-by header: PHP sets it the moment it handles the
# request, even for a fatal error, so a 500 WITHOUT it means PHP never ran
# and the file simply is not there.
php_present() {
  $CURL -sI "$SITE/$1" | grep -qi '^x-powered-by:.*PHP'
}

for f in $deployed; do
  [ -f "$f" ] || { warn "$f is in .cpanel.yml but not in this folder"; continue; }
  case "$f" in
    *.php)
      if php_present "$f"; then
        pass "$f is on the server"
      else
        code=$($CURL -o /dev/null -w '%{http_code}' "$SITE/$f")
        if [ "$code" = "403" ]; then
          pass "$f is on the server (403 — deliberately blocked from the web)"
        else
          fail "$f is NOT on the server (HTTP $code, no PHP handler) — deploy it"
        fi
      fi
      ;;
    *)
      # .htaccess redirects /foo.html to the clean /foo, so a bare request
      # answers 301 and following it is the only way to learn anything.
      code=$($CURL -L -o /dev/null -w '%{http_code}' "$SITE/$f")
      if [ "$code" = "200" ]; then
        pass "$f is on the server"
      else
        fail "$f returned $code"
      fi
      ;;
  esac
done

# ---------------------------------------------------------------
sect "The endpoints that fail closed"

# Both refuse to work rather than work badly, so silence from them is not
# reassurance. Ask them directly.
app=$($CURL "$SITE/api/application.php?selftest=1")
case "$app" in
  *'"ok":true'*) pass "the application form is accepting submissions" ;;
  '')            fail "application.php?selftest=1 returned nothing" ;;
  *)             fail "the application form is REFUSING submissions: $app" ;;
esac

chat=$($CURL "$SITE/api/chat.php?status=1")
case "$chat" in
  *'"enabled":true'*'"mode":"message"'*)   pass "chat is on, in leave-a-message mode (no agent configured)" ;;
  *'"enabled":true'*'"mode":"assistant"'*) pass "chat is on, with an agent behind it" ;;
  *'"enabled":false'*)                     fail "chat is switched off — no message box, and no alert can fire" ;;
  *)                                       fail "chat.php?status=1 said: $chat" ;;
esac

# The opt-out has a legal clock attached, so it gets its own check.
# A GET must reach the form, not an error page.
unsub=$($CURL -o /dev/null -w '%{http_code}' "$SITE/api/unsubscribe.php")
case "$unsub" in
  303|200) pass "the opt-out endpoint answers a GET ($unsub)" ;;
  *)       fail "the opt-out endpoint returned $unsub — the unsubscribe link in a live campaign is broken, and that is a CAN-SPAM violation per email" ;;
esac

# A deployed endpoint is not a working one. unsubscribe_dir lives in
# api/config.php, which is not in this repo, so the only way to know it is set
# is to ask the server. POST a deliberately malformed address: the storage
# check runs BEFORE the address is validated, so 400 proves storage is
# configured and 503 proves it is not. Nothing is written either way.
unsubcfg=$($CURL -o /dev/null -w '%{http_code}' -X POST "$SITE/api/unsubscribe.php" -H 'Content-Type: application/json' --data '{"email":"not-an-address"}')
case "$unsubcfg" in
  400) pass "opt-out storage is configured (a bad address is rejected, not refused)" ;;
  503) fail "the opt-out endpoint is live but unsubscribe_dir is unset on the server - every opt-out is being turned away. See SETUP-UNSUBSCRIBE.md" ;;
  429) warn "opt-out storage not checked - rate limited (429). Wait an hour or check by hand" ;;
  *)   fail "the opt-out endpoint answered $unsubcfg to a POST - expected 400 when configured" ;;
esac

# ---------------------------------------------------------------
printf '\n'
if [ $FAIL -eq 0 ]; then
  printf '\033[32mThe server is serving what this folder contains.\033[0m\n'
else
  printf '\033[31mThe server and this folder disagree. Fix the deploy before trusting anything.\033[0m\n'
fi
exit $FAIL
