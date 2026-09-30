#!/usr/bin/env bash
#
# compare-live.sh: prove the new site kept every page and form
#
# Reads the snapshot table in issue #8 / scripts/live-snapshot-2026-09-30.md,
# fetches the same URLs from https://tmfus.com (GET only, 1 request/sec),
# and prints per URL:
#   - old status vs new status
#   - old title vs new title
#   - whether a form that posted before still exists and where it posts now
#
# Exit code: non-zero if any URL that was 200 is now not 200.
#
# Usage:
#   ./scripts/compare-live.sh [BASE_URL] [SNAPSHOT_FILE]
#
# Defaults:
#   BASE_URL:       https://tmfus.com
#   SNAPSHOT_FILE:  scripts/live-snapshot-2026-09-30.md
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON="python3"
if ! command -v python3 >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PYTHON="python"
  else
    echo "Error: python3 or python is required to run compare-live.sh" >&2
    exit 1
  fi
fi

exec "$PYTHON" - "$@" << 'EOF'
import sys
import os
import re
import time
import html
import urllib.request
import urllib.error
import gzip

# ANSI color escape codes
C_RESET = "\033[0m"
C_BOLD = "\033[1m"
C_GREEN = "\033[32m"
C_RED = "\033[31m"
C_YELLOW = "\033[33m"
C_CYAN = "\033[36m"
C_DIM = "\033[2m"

# Known fallback form mappings for pre-redesign site
KNOWN_OLD_FORMS = {
    "/apply": "/api/application.php",
    "/contact": "/api/lead.php",
    "/privacy": "/api/lead.php",
    "/unsubscribe": "/api/unsubscribe.php",
}

def print_usage():
    print(f"""{C_BOLD}Usage:{C_RESET} ./scripts/compare-live.sh [BASE_URL] [SNAPSHOT_FILE]

Compares live site pages against the pre-redesign snapshot:
  - Old status vs new status (must remain 200 if it was 200)
  - Old title vs new title
  - Form preservation: proves forms that posted before still exist & where they post now

Defaults:
  BASE_URL:       https://tmfus.com
  SNAPSHOT_FILE:  scripts/live-snapshot-2026-09-30.md

Exit code:
  0 if every URL that was 200 is still 200
  1 if any URL that was 200 is now not 200
""")

def parse_snapshot(file_path):
    if not os.path.exists(file_path):
        print(f"{C_RED}Error: Snapshot file not found: {file_path}{C_RESET}", file=sys.stderr)
        sys.exit(2)

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    rows = []
    for line in content.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        cols = [c.strip() for c in line.split("|")[1:-1]]
        if not cols:
            continue
        col0_lower = cols[0].lower()
        if col0_lower == "url" or set(cols[0]) <= {"-", ":"}:
            continue

        url = cols[0]
        status = cols[1] if len(cols) > 1 else ""
        time_str = cols[2] if len(cols) > 2 else ""
        title = cols[3] if len(cols) > 3 else ""
        form_post = cols[4] if len(cols) > 4 else ""

        if not form_post and url in KNOWN_OLD_FORMS:
            form_post = KNOWN_OLD_FORMS[url]

        rows.append({
            "url": url,
            "status": status,
            "time": time_str,
            "title": title,
            "form": form_post,
        })
    return rows

def detect_forms(html_text):
    forms = re.findall(r'<form\b([^>]*)>', html_text, re.IGNORECASE | re.DOTALL)
    if not forms:
        return []

    results = []
    for f in forms:
        act_match = re.search(r'action=["\']([^"\']*)["\']', f, re.IGNORECASE)
        action_val = act_match.group(1).strip() if act_match else ""

        if action_val and action_val != "#":
            results.append(action_val)
        elif re.search(r'data-application\b', f, re.IGNORECASE):
            results.append("/api/application.php")
        elif re.search(r'data-(?:lead|contact)-form\b', f, re.IGNORECASE):
            results.append("/api/lead.php")
        elif re.search(r'data-optout-form\b', f, re.IGNORECASE):
            results.append("/api/lead.php")
        elif re.search(r'id=["\']unsubForm["\']', f, re.IGNORECASE) or re.search(r'data-no-remember\b', f, re.IGNORECASE):
            results.append("/api/unsubscribe.php")
        else:
            results.append("(client script)")
    return results

def extract_title(html_text):
    m = re.search(r'<title[^>]*>(.*?)</title>', html_text, re.IGNORECASE | re.DOTALL)
    if not m:
        return ""
    raw = m.group(1).strip()
    clean = html.unescape(raw)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

def fetch_url(target_url):
    req = urllib.request.Request(
        target_url,
        headers={"User-Agent": "TMF-Live-Compare/1.0 (read-only verification)"},
        method="GET"
    )
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            elapsed = time.perf_counter() - start
            body = resp.read()
            if resp.headers.get("Content-Encoding") == "gzip":
                try:
                    body = gzip.decompress(body)
                except Exception:
                    pass
            text = body.decode("utf-8", errors="replace")
            return resp.status, text, elapsed, None
    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - start
        try:
            body = e.read()
            text = body.decode("utf-8", errors="replace")
        except Exception:
            text = ""
        return e.code, text, elapsed, None
    except Exception as e:
        elapsed = time.perf_counter() - start
        return None, "", elapsed, str(e)

def main():
    args = sys.argv[1:]
    base_url = "https://tmfus.com"
    snapshot_path = "scripts/live-snapshot-2026-09-30.md"

    for arg in args:
        if arg in ("-h", "--help"):
            print_usage()
            sys.exit(0)
        elif arg.startswith("http://") or arg.startswith("https://"):
            base_url = arg.rstrip("/")
        elif arg.endswith(".md") or os.path.exists(arg):
            snapshot_path = arg

    snapshot_rows = parse_snapshot(snapshot_path)
    if not snapshot_rows:
        print(f"{C_RED}Error: No rows found in snapshot: {snapshot_path}{C_RESET}", file=sys.stderr)
        sys.exit(2)

    print(f"{C_BOLD}Comparing live site ({base_url}) with snapshot ({snapshot_path}){C_RESET}")
    print(f"{C_DIM}Rate limit: GET only, 1 request/second ({len(snapshot_rows)} URLs to check){C_RESET}\n")

    failed_status = []
    missing_forms = []
    checked_count = 0

    for idx, row in enumerate(snapshot_rows, start=1):
        if idx > 1:
            time.sleep(1.0)

        path = row["url"]
        full_url = f"{base_url}{path}" if path.startswith("/") else f"{base_url}/{path}"
        old_status = row["status"]
        old_title = row["title"]
        old_form = row["form"]

        new_status, new_html, elapsed, err = fetch_url(full_url)
        checked_count += 1

        new_title = extract_title(new_html) if new_html else ""
        new_forms = detect_forms(new_html) if new_html else []
        new_form_str = ", ".join(new_forms) if new_forms else ""

        # Status check:
        # Exit non-zero if any URL that was 200 is now not 200.
        status_ok = True
        status_str = f"{new_status}" if new_status is not None else f"ERR ({err})"
        if old_status == "200" and str(new_status) != "200":
            status_ok = False
            failed_status.append((path, old_status, status_str))

        # Form check:
        # Check whether a form that posted before still exists and where it posts now.
        form_ok = True
        if old_form:
            if not new_forms:
                form_ok = False
                missing_forms.append((path, old_form))

        # Printing per URL:
        status_badge = f"{C_GREEN}✓{C_RESET}" if status_ok else f"{C_RED}✗ (was {old_status}){C_RESET}"
        print(f"{C_BOLD}[{idx}/{len(snapshot_rows)}] {path}{C_RESET} {status_badge}")
        print(f"    Status: {old_status} -> {status_str} ({elapsed:.3f}s)")

        # Title:
        if old_title or new_title:
            if old_title == new_title:
                print(f"    Title:  {new_title} {C_DIM}(unchanged){C_RESET}")
            else:
                print(f"    Title:  {new_title}")
                print(f"            {C_DIM}was: {old_title}{C_RESET}")
        else:
            print(f"    Title:  {C_DIM}(none){C_RESET}")

        # Form:
        if old_form:
            if new_forms:
                print(f"    Form:   still exists -> posts to {new_form_str} (was: {old_form}) {C_GREEN}✓{C_RESET}")
            else:
                print(f"    Form:   {C_RED}MISSING!{C_RESET} (posted to {old_form} before, now no form found) {C_RED}✗{C_RESET}")
        else:
            if new_forms:
                print(f"    Form:   new form detected -> posts to {new_form_str} (was: none)")
            else:
                print(f"    Form:   {C_DIM}none (was: none){C_RESET}")

        print()

    print(f"{C_BOLD}{'=' * 65}{C_RESET}")
    print(f"{C_BOLD}SUMMARY:{C_RESET}")
    print(f"  URLs checked: {checked_count}")
    print(f"  Status 200 preserved: {checked_count - len(failed_status)}/{checked_count}")

    total_with_forms = sum(1 for r in snapshot_rows if r["form"])
    forms_preserved = total_with_forms - len(missing_forms)
    print(f"  Forms preserved: {forms_preserved}/{total_with_forms}")

    if failed_status or missing_forms:
        if failed_status:
            print(f"\n{C_RED}{C_BOLD}FAILURE: URLs that were 200 and are now not 200:{C_RESET}")
            for p, old_s, new_s in failed_status:
                print(f"  {C_RED}✗{C_RESET} {p}: was {old_s}, now {new_s}")
        if missing_forms:
            print(f"\n{C_RED}{C_BOLD}FAILURE: Forms that posted before and are now missing:{C_RESET}")
            for p, of in missing_forms:
                print(f"  {C_RED}✗{C_RESET} {p}: posted to {of}")
        print(f"\n{C_RED}Result: FAILED{C_RESET}")
        sys.exit(1)
    else:
        print(f"\n{C_GREEN}{C_BOLD}All invariants hold. Every page and form was kept.{C_RESET}")
        sys.exit(0)

if __name__ == "__main__":
    main()
EOF
