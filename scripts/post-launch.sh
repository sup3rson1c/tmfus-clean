#!/usr/bin/env bash
#
# post-launch.sh: is the site John just deployed actually working?
#
# Run it right after "Deploy HEAD Commit" in cPanel:
#
#   ./scripts/post-launch.sh                        # checks https://tmfus.com
#   ./scripts/post-launch.sh http://localhost:3210  # checks a local node serve.mjs
#
# It only LOOKS. Every request is a GET or a HEAD, at most one per second,
# with a User-Agent that says what it is. It never posts a form, never logs in
# and never prints the body of anything it finds where it should not be.
#
# What it checks:
#   1. every page of the build answers 200 with the title the build gave it
#   2. every URL in scripts/live-snapshot-2026-09-30.md, plus the old
#      redirected slugs, still lands on the right page
#   3. a made-up URL gets the friendly 404 page with status 404
#   4. secrets, logs, tooling and dumps are refused (403/404); admin.php sends
#      safe headers and cookie flags; http:// goes to https://; HSTS reported
#   5. every CSS/JS/image on the home page loads with the right content type
#   6. robots.txt and sitemap.xml are served and every sitemap URL is 200
#   7. form pages load and the API endpoints refuse a GET (no POST, ever)
#
# Against localhost, checks that depend on Apache, .htaccess or PHP (marked
# "server only") still run but a miss is shown in yellow and does not fail:
# the dev server has none of those things.
#
# Exit code: 0 when nothing critical failed, 1 otherwise.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON="python3"
if ! command -v python3 >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PYTHON="python"
  else
    echo "Error: python3 or python is required to run post-launch.sh" >&2
    exit 1
  fi
fi

exec "$PYTHON" - "$@" << 'EOF'
import glob
import html
import io
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from xml.etree import ElementTree as ET

# Windows Python writes cp1252 by default and dies on the first tick.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

sys.path.insert(0, os.path.join(os.getcwd(), "scripts"))
# Reused, not copied: the snapshot parser, the title reader and the form
# detector are the ones compare-live.sh uses.
from compare_live import parse_snapshot, extract_title, detect_forms  # noqa: E402

G, R, Y, B, D, X = "\033[32m", "\033[31m", "\033[33m", "\033[1m", "\033[2m", "\033[0m"
UA = "TMF-Post-Launch-Check/1.0 (read-only GET/HEAD, 1 req/s; run by the site owner)"
SNAPSHOT = "scripts/live-snapshot-2026-09-30.md"
GAP = 1.05  # seconds between requests, so never more than one per second

# Where each old address must end up. Mirrors the 301 rules in .htaccess.
LEGACY_REDIRECTS = {
    "/index": "/",
    "/index.html": "/",
    "/about.html": "/about",
    "/long-term-loans": "/sba-loans",
    "/calculator": "/funding-estimator",
    "/calculator.html": "/funding-estimator",
    "/cash-injection": "/mca",
    "/home-equity": "/heloc-calculator",
}

# Things that must never be served. Probed with HEAD only, so even if one is
# exposed, its contents are never downloaded or printed.
FORBIDDEN = [
    "/api/config.php", "/api/config.example.php",
    "/error_log", "/api/error_log", "/api/php_errors.log",
    "/api/uploads/", "/data/", "/backup/", "/backups/", "/logs/", "/log/", "/api/logs/",
    "/tools/", "/tools/index.php", "/tools/api-mock.mjs", "/tools/vendor-engine.py",
    "/scripts/verify.sh", "/src/", "/docs/",
    "/.git/config", "/.env", "/api/.env", "/.htaccess", "/.cpanel.yml",
    "/backup.sql", "/dump.sql", "/database.sql",
    "/leads.csv", "/api/leads.csv", "/leads.jsonl", "/api/leads.jsonl",
    "/package.json", "/build.mjs", "/serve.mjs", "/google-apps-script.gs", "/CLAUDE.md",
]

# Endpoints that must refuse a plain GET. unsubscribe.php is the exception by
# design: a GET just bounces to the opt-out page (RFC 8058), so 303 is right.
API_GET_REFUSERS = ["/api/lead.php", "/api/application.php", "/api/chat.php", "/api/figure-heloc.php"]
API_GET_TO_PAGE = ["/api/unsubscribe.php"]
FORM_PAGES = ["/apply", "/contact", "/privacy", "/unsubscribe"]

CONTENT_TYPES = {
    ".avif": "image/avif", ".webp": "image/webp", ".png": "image/png",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
    ".css": "text/css", ".js": "javascript", ".woff2": "font/woff2",
}


# ------------------------------------------------------------------ plumbing
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


OPENER = urllib.request.build_opener(NoRedirect)
_last = [0.0]
_cache = {}
counts = {"requests": 0}


def fetch(url, method="GET", want_body=True):
    """One request, never following redirects, throttled, cached."""
    key = (method, url)
    if key in _cache:
        return _cache[key]
    if method == "HEAD" and ("GET", url) in _cache:
        return _cache[("GET", url)]
    wait = GAP - (time.monotonic() - _last[0])
    if wait > 0:
        time.sleep(wait)
    _last[0] = time.monotonic()
    counts["requests"] += 1
    req = urllib.request.Request(url, method=method, headers={
        "User-Agent": UA, "Accept-Encoding": "identity"})
    status, headers, body, err = None, {}, "", None
    try:
        with OPENER.open(req, timeout=25) as resp:
            status, headers = resp.status, resp.headers
            if method == "GET" and want_body:
                body = resp.read(3_000_000).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        status, headers = e.code, e.headers
        if method == "GET" and want_body:
            try:
                body = e.read(3_000_000).decode("utf-8", errors="replace")
            except Exception:
                body = ""
    except Exception as e:  # DNS, timeout, refused
        err = str(e)
    result = (status, headers or {}, body, err)
    _cache[key] = result
    return result


def hdr(headers, name):
    try:
        return headers.get(name) or ""
    except AttributeError:
        return ""


def path_of(location, base):
    """Turn a Location header into a path on this site ('' if it leaves it)."""
    u = urllib.parse.urlparse(urllib.parse.urljoin(base + "/", location))
    b = urllib.parse.urlparse(base)
    if u.netloc and u.netloc != b.netloc:
        return ""
    return u.path or "/"


# ------------------------------------------------------------------ reporting
failures, warnings, skipped = [], [], []
section_name = [""]


def section(title):
    section_name[0] = title
    print(f"\n{B}{title}{X}")


def ok(msg):
    print(f"  {G}✓{X} {msg}")


def bad(msg, plain=None, server_only=False):
    if server_only and LOCAL:
        print(f"  {Y}—{X} {msg} {D}(server only: the dev server has no Apache/.htaccess/PHP){X}")
        skipped.append(msg)
        return
    print(f"  {R}✗{X} {msg}")
    failures.append((section_name[0], plain or msg))


def warn(msg, plain=None):
    print(f"  {Y}—{X} {msg}")
    warnings.append(plain or msg)


def info(msg):
    print(f"  {D}i{X} {msg}")


def show(status, err):
    return str(status) if status is not None else f"no answer ({err})"


# ------------------------------------------------------------------ setup
args = [a for a in sys.argv[1:] if not a.startswith("-")]
if any(a in ("-h", "--help") for a in sys.argv[1:]):
    print(__doc__ or "Usage: ./scripts/post-launch.sh [BASE_URL]")
    sys.exit(0)
BASE = (args[0] if args else "https://tmfus.com").rstrip("/")
host = urllib.parse.urlparse(BASE).hostname or ""
LOCAL = host in ("localhost", "127.0.0.1", "::1") or host.endswith(".localhost")

print(f"{B}Post-launch check of {BASE}{X}")
print(f"{D}Read-only: GET/HEAD only, at most 1 request per second. Takes a few minutes.{X}")
if LOCAL:
    print(f"{Y}Local server: Apache/PHP-only checks are shown in yellow and do not fail.{X}")

status, _, _, err = fetch(BASE + "/")
if status is None:
    print(f"\n{R}✗ The site did not answer at all ({err}). Nothing else can be checked.{X}")
    sys.exit(1)

# Local build: clean URL -> expected title, from the root *.html files.
pages = {}
for f in sorted(glob.glob("*.html")):
    if f == "404.html":
        continue
    slug = "/" if f == "index.html" else "/" + f[:-5]
    pages[slug] = extract_title(io.open(f, encoding="utf-8").read())
not_found_title = extract_title(io.open("404.html", encoding="utf-8").read())


def check_page(path, expect_title=None):
    status, _, body, err = fetch(BASE + path)
    if status != 200:
        bad(f"{path} returned {show(status, err)}, expected 200", f"the page {path} does not open")
        return False
    if expect_title is not None:
        got = extract_title(body)
        if got != expect_title:
            bad(f"{path} title is \"{got}\", the build says \"{expect_title}\"",
                f"the page {path} is not the new version (wrong title)")
            return False
    return True


# ------------------------------------------------------------------ 1
section("1. Every page of the new site opens, with the right title")
for path, title in pages.items():
    if check_page(path, title):
        ok(f"{path}  {D}{title}{X}")

# ------------------------------------------------------------------ 2
section("2. Every old address still works")
for row in parse_snapshot(SNAPSHOT):
    path = row["url"]
    status, headers, _, err = fetch(BASE + path)
    if status == 200:
        ok(f"{path} 200")
    elif status in (301, 308) and path_of(hdr(headers, "Location"), BASE) == LEGACY_REDIRECTS.get(path, "\0"):
        ok(f"{path} 301 to {LEGACY_REDIRECTS[path]}")
    else:
        where = hdr(headers, "Location")
        bad(f"{path} returned {show(status, err)}{' to ' + where if where else ''} (was {row['status']})",
            f"the old address {path} no longer works")
for old, new in LEGACY_REDIRECTS.items():
    status, headers, _, err = fetch(BASE + old)
    target = path_of(hdr(headers, "Location"), BASE) if status in (301, 308) else None
    if target == new:
        ok(f"{old} 301 to {new}")
    else:
        bad(f"{old} returned {show(status, err)}{' to ' + hdr(headers, 'Location') if target else ''}, expected 301 to {new}",
            f"the old address {old} does not redirect to {new}", server_only=True)

# ------------------------------------------------------------------ 3
section("3. A page that does not exist shows the friendly 404")
probe = "/post-launch-check-no-such-page"
status, _, body, err = fetch(BASE + probe)
if status == 404 and extract_title(body) == not_found_title:
    ok(f"{probe} 404 with \"{not_found_title}\"")
elif status == 404:
    bad(f"{probe} is 404 but not the friendly page (title \"{extract_title(body)}\")",
        "missing pages show a plain error instead of the friendly 404 page")
else:
    bad(f"{probe} returned {show(status, err)}, expected 404", "a missing page does not return 404")

# ------------------------------------------------------------------ 4
section("4. Security")
for path in FORBIDDEN:
    status, _, _, err = fetch(BASE + path, "HEAD")
    if status in (403, 404, 410):
        ok(f"{path} refused ({status})")
    else:
        bad(f"{path} returned {show(status, err)}, expected 403 or 404",
            f"{path} can be reached from the internet and must not be", server_only=True)

status, headers, _, err = fetch(BASE + "/admin.php")
if status is None:
    bad(f"/admin.php did not answer ({err})", "admin.php did not answer", server_only=True)
else:
    csp = hdr(headers, "Content-Security-Policy")
    if csp:
        ok(f"/admin.php sends a Content-Security-Policy")
    elif LOCAL:
        bad("/admin.php sends no Content-Security-Policy", server_only=True)
    else:
        # admin.php does not set a CSP today; report it without failing the launch.
        warn("/admin.php sends no Content-Security-Policy (admin.php does not set one yet)",
             "admin.php has no Content-Security-Policy header (not set in the code yet)")
    if hdr(headers, "X-Frame-Options").upper() in ("DENY", "SAMEORIGIN"):
        ok(f"/admin.php X-Frame-Options {hdr(headers, 'X-Frame-Options')}")
    else:
        bad("/admin.php sends no X-Frame-Options", "admin.php can be framed by another site", server_only=True)
    cookies = headers.get_all("Set-Cookie") if hasattr(headers, "get_all") else None
    cookies = cookies or []
    if not cookies:
        if status == 503:
            warn("/admin.php answered 503 (not configured on the server), so no cookie to check")
        else:
            bad(f"/admin.php ({status}) set no session cookie to check", server_only=True) if LOCAL else \
                warn(f"/admin.php ({status}) set no session cookie, so the flags could not be checked")
    for c in cookies:
        name = c.split("=", 1)[0]
        low = c.lower()
        missing = [f for f in ("secure", "httponly", "samesite") if f not in low]
        if missing:
            bad(f"/admin.php cookie {name} is missing {', '.join(missing)}",
                "the admin login cookie is missing a safety flag", server_only=True)
        else:
            ok(f"/admin.php cookie {name} is Secure, HttpOnly, SameSite")

if BASE.startswith("https://"):
    plain = "http://" + BASE[len("https://"):]
    status, headers, _, err = fetch(plain + "/")
    loc = hdr(headers, "Location")
    if status in (301, 302, 307, 308) and loc.startswith("https://"):
        ok(f"http:// redirects to https:// ({status})")
    else:
        bad(f"http:// returned {show(status, err)} {loc}, expected a redirect to https://",
            "the site does not send http:// visitors to https://")
else:
    bad("http:// to https:// redirect not checked (the address given is not https)", server_only=True)

status, headers, _, _ = fetch(BASE + "/")
hsts = hdr(headers, "Strict-Transport-Security")
info(f"HSTS: {'present (' + hsts + ')' if hsts else 'absent'} {D}(information only, John decides){X}")

# ------------------------------------------------------------------ 5
section("5. Everything the home page loads")
_, _, home, _ = fetch(BASE + "/")
refs = set()
for m in re.finditer(r'<(?:link|script|img|source|video)\b[^>]*>', home, re.I):
    tag = m.group(0)
    is_link = tag.lower().startswith("<link")
    if is_link and not re.search(r'rel="(?:stylesheet|icon|apple-touch-icon|preload|modulepreload|manifest)"', tag, re.I):
        continue
    for attr in ("src", "href", "poster", "data-src"):
        a = re.search(r'\b' + attr + r'="([^"]+)"', tag)
        if a:
            refs.add(html.unescape(a.group(1)))
    s = re.search(r'\bsrcset="([^"]+)"', tag)
    if s:
        for part in s.group(1).split(","):
            if part.strip():
                refs.add(html.unescape(part.strip().split()[0]))
for m in re.finditer(r'url\(["\']?([^)"\']+)', home):
    refs.add(m.group(1))
# Loaded by film.js, not the markup, and denied by .htaccess unless its
# exception stays below the .json deny. Silent if it breaks, so check it.
refs.add("/media/film/frames/manifest.json")

own = sorted(r for r in refs if r.startswith("/") and not r.startswith("//"))
external = sorted(r for r in refs if r.startswith(("http://", "https://", "//"))
                  and urllib.parse.urlparse(r if not r.startswith("//") else "https:" + r).netloc
                  not in (urllib.parse.urlparse(BASE).netloc, "tmfus.com"))
asset_bad = 0
for r in own:
    status, headers, _, err = fetch(BASE + r, "HEAD")
    ext = os.path.splitext(urllib.parse.urlparse(r).path)[1].lower()
    ctype = hdr(headers, "Content-Type").lower()
    want = CONTENT_TYPES.get(ext)
    if status != 200:
        bad(f"{r} returned {show(status, err)}", f"{r} (used by the home page) does not load")
        asset_bad += 1
    elif want and want not in ctype:
        msg = f"{r} served as \"{ctype or 'no type'}\", expected {want}"
        if ext in (".avif", ".webp", ".css", ".js"):
            bad(msg, f"{r} is sent with the wrong file type, browsers may refuse it")
        else:
            warn(msg)
        asset_bad += 1
if own and not asset_bad:
    ok(f"all {len(own)} files on our own server load with the right type")
for r in external:
    url = "https:" + r if r.startswith("//") else r
    status, _, _, err = fetch(url, "HEAD")
    if status == 200:
        ok(f"{D}external{X} {url}")
    else:
        warn(f"external {url} returned {show(status, err)} (not ours, but the page needs it)")

# ------------------------------------------------------------------ 6
section("6. robots.txt and sitemap.xml")
status, _, robots, err = fetch(BASE + "/robots.txt")
if status == 200 and "Sitemap:" in robots:
    ok("/robots.txt served and names the sitemap")
else:
    bad(f"/robots.txt returned {show(status, err)}", "robots.txt is missing")
status, headers, sitemap, err = fetch(BASE + "/sitemap.xml")
locs = []
if status != 200:
    bad(f"/sitemap.xml returned {show(status, err)}", "sitemap.xml is missing")
else:
    try:
        ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
        locs = [n.text.strip() for n in ET.fromstring(sitemap).iter(ns + "loc") if n.text]
        ok(f"/sitemap.xml served, {len(locs)} URLs")
    except ET.ParseError as e:
        bad(f"/sitemap.xml is not valid XML ({e})", "sitemap.xml is broken")
for loc in locs:
    path = urllib.parse.urlparse(loc).path or "/"
    status, _, _, err = fetch(BASE + path)
    if status == 200:
        ok(f"sitemap {path} 200")
    else:
        bad(f"sitemap URL {path} returned {show(status, err)}", f"the sitemap lists {path} but it does not open")

# ------------------------------------------------------------------ 7
section("7. Forms (looked at, never submitted)")
for path in FORM_PAGES:
    status, _, body, err = fetch(BASE + path)
    forms = detect_forms(body) if status == 200 else []
    if status == 200 and forms:
        ok(f"{path} loads, form posts to {', '.join(forms)}")
    else:
        bad(f"{path} returned {show(status, err)} with {len(forms)} form(s)", f"the form on {path} is missing")
for path in API_GET_REFUSERS:
    status, headers, _, err = fetch(BASE + path, want_body=False)
    if status in (400, 403, 405):
        ok(f"{path} refuses a GET ({status})")
    elif status == 500 and "php" not in hdr(headers, "X-Powered-By").lower() and not LOCAL:
        bad(f"{path} returned 500 with no PHP header: the file is probably not on the server",
            f"{path} is not on the server (forms using it will fail)")
    else:
        bad(f"{path} returned {show(status, err)} to a GET, expected 405",
            f"{path} does not answer the way it should")
for path in API_GET_TO_PAGE:
    status, headers, _, err = fetch(BASE + path, want_body=False)
    if status in (200, 303, 405):
        ok(f"{path} answers a GET without acting ({status})")
    else:
        bad(f"{path} returned {show(status, err)}, expected 303 to the opt-out page",
            "the unsubscribe link in emails is broken")

# ------------------------------------------------------------------ summary
print(f"\n{B}{'=' * 65}{X}")
print(f"{B}In plain English{X}  {D}({counts['requests']} requests to {BASE}){X}")
if not failures:
    print(f"\n{G}{B}Everything important works.{X} Every page opens, old links still land in the")
    print("right place, private files are locked away and the forms are in place.")
else:
    print(f"\n{R}{B}{len(failures)} thing(s) are broken:{X}")
    seen = set()
    for sect, plain in failures:
        if plain in seen:
            continue
        seen.add(plain)
        print(f"  {R}✗{X} {plain}")
    print("\nCopy everything on this screen and send it to Claude.")
if warnings:
    print(f"\n{Y}Worth knowing, but not a reason to panic:{X}")
    for w in warnings:
        print(f"  {Y}—{X} {w}")
if skipped:
    print(f"\n{D}{len(skipped)} check(s) only mean something on the real server and were not counted.{X}")
sys.exit(1 if failures else 0)
EOF
