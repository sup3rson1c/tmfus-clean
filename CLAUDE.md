# tmfus.com — project instructions

Marketing and lead-generation site for **TMF Team**, a US business funding
brokerage. Live at https://tmfus.com.

Read this file first. `TMF-WEBSITE-HANDOFF.md` has the full history; the
`SETUP-*.md` files have the detail on each subsystem — including
`SETUP-LEGAL.md` for the terms, the privacy policy and the cookie banner. This
file is what you need before touching anything.

---

## Before you say you are finished

```bash
./scripts/verify.sh
```

Every check in it exists because something broke once. Exit 0 or the work is not
done.

---

## The owner

John is not a developer. He deploys by clicking buttons in cPanel and judges the
site by looking at it.

- **Give cPanel and GitHub instructions as numbered steps a beginner can
  follow.** He has asked more than once to be spoken to "like I am 10". That is
  a real request and following it works.
- **He finds real bugs.** A `>` that should have been `>=`, an absurd $4K–$92K
  quote range, and a screenshot that revealed a broken storage path were all his
  catches. Take his reports seriously even when the code looks right.
- **Own mistakes plainly.** "My last few checks were nonsense, I was measuring
  my own blind spot" landed better than hedging.
- **Push back when it matters, once, with the reason.** He asked for SSN
  collection; the answer was to build it properly rather than refuse or comply
  quietly. State the trade-off, then give him the safe path to what he wants.

---

## Stack — deliberately plain

No framework. No build step. No npm. No TypeScript. Eleven static HTML pages,
one CSS file, one JS file, four PHP endpoints, one PHP admin page.

**Do not modernise this into React or add a bundler.** Every dependency is
something that can break with nobody able to fix it. This is the correct
architecture for this owner, not an oversight.

Design tokens live in `:root` at the top of `assets/styles.css`. Changing
`--accent` / `--accent-2` reskins the whole site.

---

## The three things that will bite you

### 1. Cache busting

Every page references `styles.css?v=N` and `app.js?v=N`. **Bump N in all eleven
HTML files on every CSS or JS change:**

```bash
sed -i 's/styles\.css?v=30/styles.css?v=31/g; s/app\.js?v=30/app.js?v=31/g' *.html
```

Currently **v30**. Forget it and John sees no change, reports the site broken,
and you waste a round trip proving the server is fine.

### 2. `.cpanel.yml` lists files individually

Add a new top-level file or a new `api/*.php` and **you must add it there or it
silently never deploys.** This has bitten five times in one session:
`api/` as a folder, `apply.html`, `sba-loans.html`, `api/lead.php`,
`api/chat.php`, `admin.php`.

`verify.sh` checks this. Do not skip it.

The `api/` files are copied one by one **on purpose** — `api/config.php` holds
every credential, lives only on the server, and is not in this repo. A recursive
copy would delete it. Never add one.

### 3. Nobody has push access

No session so far has had it — the GitHub App is not installed on the repo and
pushes return 403. Commit your work and **tell John it still needs pushing** via
GitHub Desktop. Do not assume it reached GitHub.

Repo: `https://github.com/sup3rson1c/tmfus-clean`, branch `tmf-team-rebrand`.
**It is PUBLIC. Never commit a credential.**

---

## Security invariants — do not weaken these

These are not style preferences. Each one is load-bearing.

- **`api/config.php` never enters the repo, chat, or client-side code.** If John
  offers to paste a credential, decline and point him at the config file on the
  server.
- **`api/application.php` fails closed.** No usable `application_pubkey` means it
  refuses the submission with 503 rather than storing an SSN in the clear. Do not
  "fix" that check.
- **A relative `application_dir` is refused.** It resolves against the script
  directory and silently writes bank statements inside `public_html`. This
  happened for real.
- **Applications are encrypted with a key the server does not hold.** RSA-OAEP
  (SHA-1 label hash, matching PHP's `OPENSSL_PKCS1_OAEP_PADDING` — not an
  oversight, change one side and every future application is unreadable) plus
  AES-256-GCM. `admin.php` serves ciphertext; the browser decrypts. **Never move
  decryption server-side.**
- **The private key lives in John's browser, wrapped under the admin password**
  (PBKDF2-SHA256, 310k iterations → AES-256-GCM, in `localStorage` under
  `tmf_admin_key_v2`). The **login page** unwraps it as the form submits and
  parks it in IndexedDB `tmf-admin/keys/priv` as a **non-extractable**
  CryptoKey; the inbox page picks it up, so signing in is the only step. It is
  dropped on sign-out, on Lock, and after 20 idle minutes.
  **Never store the typed password anywhere** — the handoff is the key handle
  precisely so the password does not have to travel. Do not make the key
  extractable, and do not add a server-side recovery path: there is no reset by
  design, and that is the property that makes a stolen server worthless.
  `scripts/crypto-chain-test.mjs` proves the chain; `verify.sh` runs it.
- **Nothing that tracks a visitor may load before `initConsent()` says so.** No
  analytics or pixel snippet in markup, ever. Ids go in `TAGS` in `app.js` and
  are fetched only after the matching category is accepted. GPC is honoured
  automatically.
- **The sharing consent has a version id.** `data-consent-text-id` on the
  authorization box in `apply.html` is stored with every signed application.
  Currently `tmf-auth-2026-08c`. Change a word of that wording and you must
  change the id, or you lose the ability to prove what somebody agreed to.
- **SSN, DOB and signature go to the whole funding industry, by John's
  instruction of 20 Aug 2026** — funders, lenders, brokers, ISOs, syndicators,
  buyers, servicers, verification services — and TMF may be paid for it. The
  documents say so plainly. What they still do not do is offer those three
  fields to advertising platforms or general data brokers, because consent does
  not lift the GLBA Safeguards Rule and several states restrict SSN disclosure
  regardless. He was told this and told it is a wording change away if he wants
  it. **If he asks again, write it** — it is his call, and he has been given the
  reason once.
- **Nothing matching `ssn`, `dob`, `birth`, `social`, `sig`, `signature` reaches**
  an email, the leads sheet, `summary.json`, or a chat transcript. Enforced
  independently in `application.php`, `lead.php`, `chat.php` and `app.js`.
- **Never put personal data in a query string.** Logs, history, referrers.
- **Never let a form claim a message was sent when nothing was transmitted.** The
  application success pane appears only after the server confirms storage.
- **Chat messages render with `textContent`, never `innerHTML`.** The text comes
  from a language model and from strangers.
- **API keys stay server-side.** The chat widget knows one URL: `/api/chat.php`.

---

## Layout

```
index.html               Home
funding-estimator.html   Cash-injection calculator + product matching
heloc-calculator.html    HELOC estimator + Figure offers panel + FAQ
sba-loans.html           SBA 7(a) and 504. No calculator, by request
mca.html                 Merchant cash advance
apply.html               4-step application, all 29 fields, encrypted
about.html  contact.html  404.html
terms.html               Terms of Use + consent to share + arbitration
privacy.html             Privacy + cookie policy + the Do Not Sell opt-out
admin.php                Password-protected inbox + live chat takeover
robots.txt sitemap.xml llms.txt
assets/styles.css        Whole design system, tokens in :root
assets/app.js            Every interaction, both calculators, chat widget
api/application.php      Application intake, encrypts at rest, ?selftest=1
api/lead.php             Every submission stored server-side + monthly CSV
api/chat.php             Live chat proxy to John's Hermes agent
api/figure-heloc.php     Figure HELOC API proxy, ?selftest=1
api/config.example.php   Template. Real config.php lives ONLY on the server
scripts/verify.sh        Invariant checker — run before finishing
scripts/crypto-chain-test.mjs  Seal → wrap → unlock → decrypt, for real
seo-inject.py            Canonicals, robots, schema AND sitemap.xml
```

---

## Self-checks you can point John at

```
https://tmfus.com/api/application.php?selftest=1
https://tmfus.com/api/figure-heloc.php?selftest=1
```

Plain-English reports. Neither reveals a key, a path, or applicant data.

---

## Business rules John set

Do not change these without asking him.

```
projection = monthly_revenue × industry_multiplier × credit_multiplier
             × PROJECTION_TRIM (0.90)
             − outstanding_balance
range      = projection ± 15%
```

- `PROJECTION_TRIM = 0.90` — a flat 10% haircut, his instruction 20 Aug 2026.
  Applied to the **gross**, before the balance deduction. Applying it after
  would also shrink the penalty for what a merchant already owes, which is a
  more generous answer, not a smaller one.

- Industry multipliers (his real figures, 18 Aug 2026): restaurant 1.20,
  healthcare 1.20, retail 1.10, construction 0.80, trucking 0.75, everything
  else 1.00.
- `BALANCE_DEDUCTION_RATE = 1.0` — he chose 1.0 over 0.8.
- A "positions factor" used to apply on top of the balance deduction. It
  double-penalised merchants and was removed on his instruction. **Do not
  reintroduce it.**
- Cash injection $5K–$2M. HELOC caps at $750K.
- **Bank statements are required: four months, every state.**
  `STATEMENTS_MIN` in `app.js`, with a per-state exceptions map.
- The revenue-based estimator and equipment financing cards were **removed** from
  the home page by him. Do not restore them.
- The result screen offers **apply**, **talk to us in the chat**, and — for
  credit **650 and up only** — **the HELOC calculator**. Below 650 there are two
  options, numbered 1 and 2, not a gap where the third was: the numbers are
  generated by `n()`, never written down. The gate is `>= 650`, because the
  "650 – 699" band reports `650`. It appears **only after an estimate**.
- The bad-email wording is **"Not a valid email address."**, John's words, in
  `EMAIL_ERROR` in `app.js`. Every form uses that one constant. Note the
  application's email box is on **step 2**, not step 3.
- `long-term-loans.html` was replaced by `sba-loans.html`. The 301 sits in
  `.htaccess` **before** the clean-URL rewrite. Order matters.

---

## Traps that have already cost real time

- **Testing in a background browser tab.** Chrome freezes `requestAnimationFrame`
  in hidden tabs. Three sessions concluded parallax was broken while
  `visibilityState` was `"hidden"`. Confirm the tab is foregrounded.
- **Nine identical failures share a cause.** Figure returned HTTP 500 across
  nine payload variations; the conclusion was "Figure's outage". It was a
  published *sandbox* affiliate ID pointed at the production API. When a whole
  class of attempts fails the same way, suspect what they have in common.
- **Immutable cache headers.** `.htaccess` once served CSS/JS with
  `max-age=31536000, immutable`. Now `max-age=3600, must-revalidate` plus `?v=N`.
  Do not optimise it back.
- **Float serialization.** Figure rejects `250000.0`. Cast money fields to int.
- **`>` vs `>=` on dropdown bands.** The 650–699 band reports `650`, so
  `credit > 650` silently excluded it. Check what a control actually reports.
- **`[hidden]` loses specificity fights.** `.field { display: grid }` overrode it.
  `[hidden] { display: none !important; }` is in the CSS. **Screenshot your work.**
- **Per-scope validation misses cross-scope rules.** Ownership % was summed per
  step, so 100% + 50% passed. Validate the whole form.
- **`.bullets li` is a two-column grid.** Wrap everything after the tick in one
  `<span>`.
- **A stale Playwright bounding box.** Three "signature failed" results were the
  test measuring a canvas that had moved. Re-measure immediately before drawing.
- **A hidden tab freezes CSS transitions too, not just rAF.** Measuring the
  cookie bar in a background tab reported it stuck at `opacity: 0` and 18px
  off-position, because the transition never advances. The class was applied
  correctly the whole time. Set `transition: none` before measuring, or
  foreground the tab.
- **There is no `php` on every machine.** `verify.sh` now skips the PHP lint
  with a warning rather than reporting six failures for one missing binary.
  A PHP change made on such a machine has NOT been syntax-checked — say so.

---

## Testing

There is no test suite. What exists:

```bash
./scripts/verify.sh                 # invariants
php -l api/*.php && node --check assets/app.js
php -S 127.0.0.1:8080 -t .          # local server (no .htaccess, so no clean URLs)
```

Playwright and Chromium are available for real browser testing, and the whole
application → encryption → decryption chain has been verified that way. If you
change anything in that chain, verify it the same way rather than reasoning
about it.

---

## Still open, and waiting on John

1. **A phone number and a physical address.** Raised in six sessions, never
   answered. No phone means no Google Business Profile, no local search results,
   and a trust gap on a finance site. The `Organization` schema has a deliberate
   hole where `telephone` and `address` go — **do not invent values**, wrong NAP
   data propagates.
2. **A real Figure affiliate ID.** The current one is Figure's published
   sandbox ID. `environment` must be `test` until a real one exists.
3. **Whether the Figure account should be TMF's rather than Signet's.** The
   application side was taken in-house on 18 Aug 2026; the Figure affiliate
   account still belongs to Signet Capital Group.
4. **A retention policy.** Nothing prunes applications, leads, chat transcripts
   or opt-out requests, and TMF now holds Social Security numbers. The privacy
   policy says "as long as we need it", which is true and vague. He needs to
   pick a number.
5. **FTC Safeguards Rule obligations.** Encryption covers part of it. A written
   security policy, access limits and a breach plan are not built.
6. **Two blanks left in the legal pages** — business mailing address, and the
   state whose law governs. Marked `TO BE COMPLETED` in `terms.html` and
   `privacy.html`. **`verify.sh` fails on this on purpose** and will keep
   failing until he answers; do not "fix" it by inventing values or by deleting
   the check. See `SETUP-LEGAL.md`.
   *(Answered 20 Aug 2026: there is no registered company. The documents now
   say TMF Team is a trading name and the agreement is with the individual.
   That means the limitation of liability protects nothing — he has been told.)*
7. **`privacy@tmfus.com` and `legal@tmfus.com` do not exist yet.** Both are
   quoted throughout the legal pages. He creates them in cPanel.
8. **A lawyer has not read the terms or the privacy policy.** They are written
   to industry standard and are specific to what TMF does, but nobody
   qualified has reviewed them. Say so whenever they come up. This matters more
   now that the documents authorise selling SSNs and dates of birth.
9. **`admin.php` is password-only, no second factor.** The FTC Safeguards Rule
   expects MFA for anyone reaching customer information, and this is the real
   authentication gap — not the key handling, which is stronger than most.
   Offered to John 20 Aug 2026, not yet asked for.
10. **No PHP on the machine used on 20 Aug 2026.** `admin.php` and
   `api/application.php` were edited and their JavaScript was checked, but the
   PHP itself was never linted. First thing to do somewhere with `php`.
