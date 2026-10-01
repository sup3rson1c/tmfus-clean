# Final pre-launch test report — redesign-2026

Date: 2026-10-01
Scope: local-only pre-launch test after all launch PRs merged into `redesign-2026`
Base: `http://localhost:3200` (`node serve.mjs 3200`)
Constraints followed: no submission or navigation to live `https://tmfus.com`; every `/api/*.php` request stayed on the local mock server.

## Environment

- Linux x86_64
- Node v26.7.0
- PHP 8.3.6 (CLI)
- Google Chrome 146.0.7680.164 (headless) via `CHROME_PATH=/usr/bin/google-chrome`

## Commands run

| Check | Command | Result |
|---|---|---|
| Build | `node build.mjs` | PASS — built 12 HTML pages, CSS, and sitemap |
| Invariants | `bash scripts/verify.sh` | PASS — “All invariants hold” |
| Interactions/forms | `node tools/interact.mjs` | PASS — 29/29 checks |
| Accessibility/layout | `node tools/audit.mjs` | PASS — 0 axe issues at 1440px and 390px |
| Page sweep, redirects, 404, extra forms, console | `node tools/prelaunch-final.mjs` | PASS — all checks green |
| Page weight desktop | `node tools/weight.mjs --w 1440` | PASS — completed |
| Page weight phone | `node tools/weight.mjs --w 390` | PASS — completed |

## Per-page rendering and console check

Every page was loaded at desktop width (1440px) and phone width (390px). Each page returned HTTP 200, rendered a page title, and showed no horizontal overflow. Console/pageerror/request failure listeners were attached across the full sweep.

| Page | Desktop 1440px | Phone 390px | Console errors |
|---|---:|---:|---|
| `/` | PASS | PASS | None |
| `/funding-estimator` | PASS | PASS | None |
| `/mca` | PASS | PASS | None |
| `/sba-loans` | PASS | PASS | None |
| `/heloc-calculator` | PASS | PASS | None |
| `/apply` | PASS | PASS | None |
| `/about` | PASS | PASS | None |
| `/contact` | PASS | PASS | None |
| `/terms` | PASS | PASS | None |
| `/privacy` | PASS | PASS | None |
| `/unsubscribe` | PASS | PASS | None |
| `/404` | PASS | PASS | None |

## Forms and interactive flows

| Flow | Checks | Result |
|---|---|---|
| Funding estimator | Empty-step validation, named field errors, bad email wording, projected result, saved estimate for Apply | PASS |
| Application | Empty-step validation, all four steps, owner and co-owner flow, four local statement uploads, signature capture, local mock reference (`TMF-64F50D`), success pane | PASS |
| Contact form | Required-field summary, named field errors, bad email wording, success only after local mock confirms | PASS |
| Chat | Launcher, open, message send, callback details, close/restore launcher | PASS |
| Unsubscribe | Bad email wording, accepted local mock request | PASS |
| Cookie banner/settings | Accept all, save chosen categories, reject non-essential | PASS |
| Privacy “Do Not Sell or Share” form | Bad email wording, accepted local mock request, confirmation pane shown, analytics/marketing cookies switched off | PASS |
| HELOC handoff | Page intentionally states the instant estimator is being rebuilt and routes users to `/apply` | PASS |
| Product intent from HELOC CTA | `/apply?product=heloc` arrives with the product select set to `HELOC` and still editable | PASS |

## Redirects and 404

| Check | Result |
|---|---|
| `/index` → `/` | PASS |
| `/home` → `/` | PASS |
| `/long-term-loans` → `/sba-loans` | PASS |
| `/calculator` → `/funding-estimator` | PASS |
| `/cash-injection` → `/mca` | PASS |
| `/home-equity` → `/heloc-calculator` | PASS |
| `/admin` → `/admin.php` | PASS |
| Missing page returns HTTP 404 with friendly page | PASS |
| Friendly 404 includes links to Apply / product paths / Contact | PASS |

## Console errors

No unexpected browser console errors, page errors, failed requests, or uncaught exceptions were detected during the full sweep and form flows. The only filtered 404 was the intentional request to the made-up missing-page URL used to prove the friendly 404 behavior.

## Page weights

### Desktop width (`--w 1440`)

| Page | Initial load | After scroll |
|---|---:|---:|
| `/` | 951 KB | 8,364 KB |
| `/funding-estimator` | 585 KB | 585 KB |
| `/heloc-calculator` | 518 KB | 540 KB |
| `/sba-loans` | 528 KB | 551 KB |
| `/mca` | 568 KB | 590 KB |
| `/apply` | 534 KB | 534 KB |
| `/about` | 540 KB | 562 KB |
| `/contact` | 485 KB | 485 KB |
| `/privacy` | 507 KB | 507 KB |
| `/terms` | 505 KB | 505 KB |
| `/unsubscribe` | 484 KB | 484 KB |
| `/404` | 482 KB | 482 KB |

### Phone width (`--w 390`)

| Page | Initial load | After scroll |
|---|---:|---:|
| `/` | 951 KB | 7,351 KB |
| `/funding-estimator` | 585 KB | 585 KB |
| `/heloc-calculator` | 518 KB | 540 KB |
| `/sba-loans` | 528 KB | 550 KB |
| `/mca` | 567 KB | 590 KB |
| `/apply` | 534 KB | 534 KB |
| `/about` | 539 KB | 562 KB |
| `/contact` | 485 KB | 485 KB |
| `/privacy` | 507 KB | 507 KB |
| `/terms` | 505 KB | 505 KB |
| `/unsubscribe` | 483 KB | 483 KB |
| `/404` | 481 KB | 481 KB |

## Notes and limitations

- This was a local pre-launch test against the mock API only. It does not prove the live PHP deployment on tmfus.com is current.
- The live `.htaccess` redirect rules are mirrored by `serve.mjs`; the redirect checks above verify the local server behavior for the same route map.
- The prior issue-#19 mobile accessibility failures (`/about`, `/privacy`) were not reproduced by the current merged branch; the axe scan passed at both widths.
- No form data was submitted to production endpoints.
