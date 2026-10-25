#!/usr/bin/env bash
# Tell Bing (and every IndexNow engine: Yandex, Seznam, Naver) that the pages
# in sitemap.xml exist or changed. ChatGPT search draws on Bing's index, so
# this is the quickest way for a new or edited page to become findable there.
# Run after a deploy. The key file is public by design: it only proves the
# ping comes from whoever controls tmfus.com. https://www.indexnow.org
set -euo pipefail
KEY="ea2d0f4bd120bbfac1028578d8a51057"
HOST="tmfus.com"
code=$(curl -s -o /dev/null -w '%{http_code}' "https://$HOST/$KEY.txt")
[ "$code" = 200 ] || { echo "key file not live yet (HTTP $code): deploy first"; exit 1; }
urls=$(curl -s "https://$HOST/sitemap.xml" | grep -o '<loc>[^<]*' | sed 's/<loc>//' | sed 's/.*/"&"/' | paste -sd, -)
body="{\"host\":\"$HOST\",\"key\":\"$KEY\",\"keyLocation\":\"https://$HOST/$KEY.txt\",\"urlList\":[$urls]}"
curl -s -o /dev/null -w 'IndexNow: HTTP %{http_code} (200 or 202 = accepted)\n'   -H 'Content-Type: application/json; charset=utf-8' -d "$body" https://api.indexnow.org/indexnow
