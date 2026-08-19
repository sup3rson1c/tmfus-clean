# TMF Team website — full handoff

Written for whoever picks this up next, human or AI, with **no prior context**.
Everything needed to continue is in this file and the repository beside it.

**Last updated: 18 August 2026 — assets at `?v=27`.**
**v22 is a big one: TMF now collects the whole application itself, encrypted.
Signet is out of the site entirely. See §5.3, which was rewritten. v21 was the
real industry multipliers (§4). Neither is committed — this work arrived as a
zip with no `.git` directory, so it needs committing on John's machine.**

If you are an AI reading this at the start of a session: read sections 1, 2 and
3, then skim section 9 before touching anything. Section 8 lists the traps that
have already cost real time — they will cost you the same time again.

---

## 1. What this is

A marketing and lead-generation site for **TMF Team** (formerly "TMF Line"), a
US business-funding brokerage. Live at **https://tmfus.com**.

The owner is **John** (jonathanorel141103@gmail.com). He is not a developer. He
deploys by clicking buttons in cPanel and judges the site by looking at it.

### Stack: deliberately plain

No framework. No build step. No npm. No TypeScript. Nine static HTML pages, one
CSS file, one JS file, two PHP endpoints. Open `index.html` in a browser and it
works.

**Do not "modernise" this into React or add a bundler.** Every dependency added
is a thing that can break with nobody able to fix it. This constraint is not
laziness — it is the correct architecture for this owner.

```
index.html               Home — hero, products, stages, CTA
funding-estimator.html   3-step cash-injection calculator + product matching
heloc-calculator.html    HELOC estimator + Figure API offers panel + FAQ
sba-loans.html           SBA 7(a) and 504 explainer. No calculator by request
mca.html                 Merchant cash advance explainer
apply.html               Branded 4-step application, hands off to Signet
about.html               Mission, approach, stats
contact.html             Contact form
404.html                 Not found
assets/styles.css        Entire design system. Tokens in :root at the top
assets/app.js            Every interaction, both calculators, all integrations
api/figure-heloc.php     Server-side proxy to Figure's HELOC API
api/application.php      Application intake — encrypted at rest
api/lead.php             Every submission, stored on our own server
api/chat.php             Live chat — proxies to John's Hermes agent
admin.php                Password-protected inbox for applications and leads
api/config.example.php   Template. Real config.php lives ONLY on the server
```

**Design tokens** (top of `styles.css`): background `#0a0a0b`, text `#fafafa`,
accents `#34d399` emerald → `#4aa5e8` blue, font Geist, radius `0.75rem`,
`--ease: cubic-bezier(0.22, 1, 0.36, 1)`. Changing `--accent` / `--accent-2`
reskins the whole site.

---

## 2. Repository and deployment

**Repo:** `https://github.com/sup3rson1c/tmfus-clean`
**Current working branch: `tmf-team-rebrand`. It is PUBLIC. Never commit credentials.**

### 22 commits are unpushed

No session so far has had push access — the GitHub App is not installed on that
repo, and pushes return 403. John pushes them himself via GitHub Desktop. If you
finish work, commit it and **tell him it still needs pushing**; do not assume it
reached GitHub.

### Deploy pipeline

1. Push to GitHub
2. cPanel → **Git Version Control** → **Manage** → **Pull or Deploy**
3. **Update from Remote**, then **Deploy HEAD Commit**

`.cpanel.yml` controls what gets copied into `public_html`, and it lists files
**individually**. Add a new top-level file and you must add it there or it
silently never deploys. This has already bitten twice — once for the whole `api/`
folder, once for `apply.html` and `sba-loans.html`.

`.cpanel.yml` deliberately does **not** recursively copy `api/`, because
`api/config.php` holds the Figure credential, lives only on the server, and is
not in the repo. A recursive copy would delete it. Never add one.

### Cache busting — do not skip this

Every HTML file references assets as `styles.css?v=N` and `app.js?v=N`.
**Bump N on every CSS or JS change, in every HTML file:**

```bash
sed -i 's/styles\.css?v=27/styles.css?v=28/g; s/app\.js?v=27/app.js?v=28/g' *.html
```

Currently at **v27**. Forget this and John sees no change, reports the site is
broken, and you will waste a round trip proving the server is fine.

---

## 3. Current state — what works

| Area | State |
|------|-------|
| Rebrand TMF Line → TMF Team | Done everywhere, "Capital Strategy" retained underneath |
| Logo ("Ascent" — three rising bars) | Done, animates on hover |
| Parallax scrolling | Working. Took several escalations, see §8 |
| Custom branded scrollbar | Done |
| Momentum scrolling | Done |
| Lead capture | Google Sheet **plus** `api/lead.php` on our own server, since v24 |
| Cash injection calculator | Working, formula per John's spec |
| HELOC calculator | Working. Figure API integration **blocked**, see §6.1 |
| SBA page | Done, facts web-verified against SOP 50 10 8 |
| Branded application | **Rebuilt 18 Aug 2026.** TMF collects all 29 fields; encrypted at rest, §5.3 |
| Bank statement upload | Working, hardened. **Now required**, 3 months, 4 in listed states |

---

## 4. The calculator formula

John specified this directly. Do not change it without asking him.

```
projection = monthly_revenue × industry_multiplier × credit_multiplier
             − outstanding_balance
range      = projection ± 15%
```

In `assets/app.js`, `estimateAdvance()` around line 700.

```js
const BALANCE_DEDUCTION_RATE = 1.0;   // John chose 1.0 over 0.8
const RANGE_SPREAD = 0.15;            // was much wider, he said 4K–92K was absurd
const CREDIT_MULT = [
  { min: 740, mult: 1.40 }, { min: 660, mult: 1.15 },
  { min: 600, mult: 0.925 }, { min: 0, mult: 0.75 }
];
```

**`INDUSTRY_MULT` now holds John's real figures**, supplied by him on 18 Aug
2026 and no longer placeholders:

```js
restaurant 1.20   healthcare 1.20   retail 1.10
construction 0.80   trucking 0.75
wholesale / salon / other 1.00     // "everything else stays at 1"
```

Do not change these without asking him. Note this raised quotes for wholesale
(0.95 → 1.00), salon (1.00) and other (0.90 → 1.00), and lowered construction
(0.85 → 0.80) and trucking (0.80 → 0.75).

A "positions factor" used to also apply on top of the balance deduction. That
double-penalised merchants and was removed on John's instruction. Do not
reintroduce it.

Cash injection range is **$5K – $2M**. HELOC caps at **$750K**.

---

## 5. Integrations

### 5.1 Lead capture → Google Sheets — WORKING

`LEAD_ENDPOINT` at the top of `app.js` is a Google Apps Script Web App that
appends each submission to John's spreadsheet. Verified live; two TEST rows were
written. `google-apps-script.gs` in the repo is the script behind it.

`sendLead(kind, data)` posts `no-cors`, so **the browser cannot read the
response**. You cannot tell success from failure client-side. If the endpoint is
ever set to an empty string, the forms say so rather than faking success. Keep
that behaviour — never let a form claim a message was sent when nothing was
transmitted.

### 5.2 Figure HELOC API — BLOCKED ON FIGURE

See `SETUP-FIGURE-API.md`. Summary in §6.1.

### 5.3 The application — TMF's own, encrypted — REBUILT 18 Aug 2026

Read `SETUP-APPLICATION.md` before touching any of this.

John asked for the Signet name off the site and for all 29 fields collected in
his own form. That was done. `apply.html` now collects everything, SSN, date of
birth and signature included, and posts it to `api/application.php`. There is no
redirect, no altaFlow, no `alfw.at` link, no pre-fill parameters. `grep -ri
signet` over the site returns nothing.

**How the sensitive half is protected.** Each application is sealed with a fresh
AES-256-GCM key, and that key is sealed with an RSA public key on the server.
The private key is not on the server and must never be put on it — it lives on
John's machine inside `tmf-application-tool.html`, which also generates the pair
and decrypts applications entirely offline. A stolen hosting account yields
ciphertext and nothing else.

**Verified end to end on 18 Aug 2026**, not assumed: a real multipart POST to
`api/application.php` in a live PHP server, encrypted on disk, then decrypted in
Chromium through the actual tool. The stored directory was searched for the test
SSN and it does not appear in plaintext anywhere. Wrong-key decryption fails
with a clear message and leaks nothing. A `.exe` renamed `statement.pdf` is
still rejected on its bytes.

**A relative `application_dir` is refused.** Hit for real on 18 Aug 2026: the
value in `config.php` was missing its leading slash, so PHP resolved it against
the script directory and started building
`public_html/api/home/<user>/tmf-applications` — customer bank statements inside
the web root, with everything appearing to work. `application.php` now refuses
to run with a relative path and the self-check says so in plain words;
`lead.php` falls back to its protected default rather than losing an enquiry.
The self-check also warns when an absolute path still resolves inside
`DOCUMENT_ROOT`.

**Rules that must not be weakened:**

- `api/application.php` **fails closed**: no usable `application_pubkey` in
  config means it refuses the submission with a 503. It does not store an SSN in
  the clear and does not pretend it saved anything. Do not "fix" this check.
- The success pane appears only after the server confirms storage. If the POST
  fails the applicant is told to call rather than shown a receipt.
- Nothing matching `ssn`, `dob`, `birth`, `social`, `sig` or `signature` reaches
  the notification email, `summary.json`, or the Google Sheets lead summary.
  Both sides enforce this independently.
- The OAEP label hash is **SHA-1 on both sides on purpose** — PHP's
  `OPENSSL_PKCS1_OAEP_PADDING` gives no way to change it. Change one side and
  every future application becomes permanently unreadable.

**The authorization text now names TMF Team**, not Signet, because the applicant
is authorizing TMF to pull their credit. It carries the id `tmf-auth-2026-08`,
stored with every signature. Change the wording, change the id.

**Two things John should be told again if he has not acted on them:** he is now
holding Social Security numbers, which brings FTC Safeguards Rule obligations
that did not apply when Signet held the data; and nothing prunes old
applications, so retention is a decision he has to make.

## 6. Open items

### 6.1 Figure 500s — DIAGNOSED 18 Aug 2026. It was never Figure's bug.

**The previous conclusion in this file was wrong, and it was repeated to John at
the start of another session before anyone checked.** Recorded here in full so
nobody re-derives it.

`api/config.php` on the server had:

```php
'affiliate_id' => 'e5c722ec-eaf1-4cb1-8fcb-f2c16b31fade',
'environment'  => 'production',
```

That affiliate ID is one of **Figure's published sandbox IDs** — it is printed in
their documentation as a test credential, and the comment directly above it in
`config.example.php` says so. John confirmed he never had a real affiliate ID and
had been testing with the example value. Sent to `api.figure.com` it is simply
unknown, and Figure answers **HTTP 500**, which reads like their server falling
over rather than a credential problem. That is what sent two sessions down the
wrong path: nine payload variations tested against production, on a credential
that only exists in the sandbox.

**Lesson worth keeping:** "isolated across nine payload variations" felt like
thorough elimination, but every one of those nine shared the same unexamined
assumption. When a whole class of attempts fails identically, suspect the thing
they have in common rather than varying them further.

**Two ways forward:**

- To test: `'environment' => 'test'` in `config.php` sends the sandbox ID to
  `api.test.figure.com`, which is what it is for. One word, no deploy needed —
  `config.php` is not in the repo.
- To go live: a real affiliate ID from Figure. Note the existing Figure Lead
  Portal account belongs to Signet, not TMF — see §6.4.

`api/figure-heloc.php` now **refuses** the sandbox-ID-plus-production
combination outright and writes the explanation to the log, rather than letting
it fail as an opaque 500. Verified: the combination is blocked, the same ID
against `test` passes through to normal validation, and a real-looking ID on
production is unaffected.

Still open and worth confirming with Figure once a real ID exists: whether
`householdIncome` should be annual or monthly (we send annual,
`income_is_annual` in config).

### 6.2 No phone number or email anywhere on the site

**Flagged at least four times across sessions. Never supplied.** The contact page
has opening hours and response times but no way to reach a human. A
business-funding site without a phone number costs conversions. Ask again.

### 6.3 Real industry multipliers — RESOLVED 18 Aug 2026

John supplied them. See §4. No longer placeholders.

### 6.4 Whose partnership is this? — HALF RESOLVED

The application half is settled: as of 18 Aug 2026 TMF collects its own
applications and Signet is out of the site entirely.

**The Figure half is not.** The Figure Lead Portal account still belongs to
Signet Capital Group (Michael Gold, michael@signetcapitalgroup.com,
LOAN_ORIGINATOR, orgs "Figure NY Wholesale SMB" / "Figure Wholesale SMB"), so
HELOC leads from tmfus.com still land in Signet's account. Given John has just
taken applications in-house, ask him whether he wants his own Figure affiliate
account too. It is currently moot — Figure returns 500 on everything, §6.1 —
but it is the same question and it is still open.

### 6.5 Deliberately left alone

- Revenue-based estimator and equipment financing cards — **John had these
  removed** from the home page. Do not restore them.
- The "Do you like the numbers?" CTA appears **only after an estimate**, never
  on the home page. He asked for this specifically.
- `long-term-loans.html` was **replaced** by `sba-loans.html`. A 301 sits in
  `.htaccess` **before** the clean-URL rewrite. Order matters, see §8.

---

## 6A. Submission storage and visitor memory — added 18 Aug 2026

**Every submission is stored twice.** `sendLead()` posts to the Google Apps
Script as before *and* to `api/lead.php`, which writes
`<application_dir>/leads/YYYY-MM/` — one JSON per submission plus a monthly
`leads.csv` that opens in Excel. The Sheet is posted `no-cors` and its response
is unreadable, so it can never confirm anything; `lead.php` answers properly and
is now what the contact form's success message is based on.

`lead.php` drops any field whose name looks like an SSN, date of birth or
signature, and logs the drop. Those belong only in the encrypted application.

**`api/lead.php` is in `.cpanel.yml`.** It had to be added by hand — the deploy
lists files individually, and this is the third time that has nearly bitten.
Miss it and every form on the site reports failure to the visitor, because the
contact form now believes the endpoint that actually answers.

**Visitor memory.** What someone types in any form is kept in their own browser
under `tmf_visitor_v1` and pre-fills the application. It fills only empty fields,
shows a visible notice saying what was carried over, and cannot hold anything
sensitive. `INDUSTRY_LABEL` maps the calculators' short codes to the
application's full labels — add an option to one list without adding the pairing
and the industry silently stops carrying across.

## 6B. The inbox — admin.php, added 18 Aug 2026

John asked for somewhere he could read applications without cPanel. `admin.php`
is a single self-contained page: password login, a searchable list of every
application and lead, statement downloads, CSV export.

**It never decrypts anything, and it cannot.** The private key is not on the
server. The page serves the sealed envelope byte for byte and the browser opens
it with the key John loads from his own machine. A stolen password, a stolen
session or a stolen server still yields no SSN, DOB or signature. Say this
plainly to anyone proposing to "simplify" it by decrypting server-side — that
change would undo the entire design.

**What the password does gate:** names, businesses, emails, phones and the
bank statements, which are not encrypted. That was an explicit, stated trade.

Refuses to run at all when: no `admin_password` / `admin_password_hash` is set,
the connection is plain HTTP (except localhost), or `application_dir` is
missing or relative.

Defences, all tested on 18 Aug 2026 against a live server:

- Every endpoint 401s without a session; traversal attempts on `folder` and
  `name` return 404 — paths are rebuilt from a `scandir()` listing plus a
  strict name pattern, never from browser input.
- Login rate-limited to 10 attempts per IP per hour, constant-time compare,
  400ms delay, session id regenerated on success, one-hour idle timeout.
- Cookie is HttpOnly, SameSite=Strict, Secure over HTTPS.
- `noindex, nofollow`, and `X-Frame-Options: DENY`.

**`admin.php` is in `.cpanel.yml`.** Fourth new file this session that needed
adding by hand.

## 6C. Live chat — added 18 Aug 2026

Widget on every page, built by `initChat()` in `app.js`. Visitor talks to
`api/chat.php`; that file talks to John's Hermes agent. Off until
`chat_enabled` is true. Full detail in `SETUP-CHAT.md`.

**The key never reaches the browser.** Verified with a real key in config: it
appears in the request to the agent and nowhere in the page HTML or `app.js`,
and neither does the agent URL. Any change that moves the model call into
client-side JavaScript is a leaked credential — do not accept one.

**Takeover.** John joins from the inbox's Live chat tab; `human` flips true and
`chat.php` stops calling the agent for that conversation entirely. Handing back
clears it. Operator turns are fed to the agent as assistant messages, so a
handed-back conversation does not contradict what John just said. Tested end to
end in two browsers: the visitor saw the operator's reply within one poll, and
the agent stayed silent throughout.

**SSN scrubbing.** Anything SSN-shaped becomes `[removed]` before storage,
before the agent, before John. Tested with two formats then grepping every
stored file and the agent's received payload — absent from both. Deliberately
eager; a false positive is cheap and a false negative is forever.

**Guardrails in the prompt:** never quote a rate, amount or approval; never
claim an approval; never ask for SSN, DOB or bank credentials; never claim to be
human. If `chat_system_prompt` is ever replaced, those rules must survive —
John is a broker and a chatbot's quote is a representation.

**Transcripts are NOT encrypted**, unlike applications. They hold names and
phone numbers, never SSNs. Nothing prunes them.

**`api/chat.php` is in `.cpanel.yml`.** Fifth file this session needing it.

## 7. Tunable knobs

All at the top of their sections in `assets/app.js`:

| Constant | Line ~ | Does |
|----------|--------|------|
| `LEAD_ENDPOINT` | 27 | Google Sheets destination |
| `APPLICATION_URL` | 43 | Signet application link |
| `APPLICATION_MODE` | 1366 | `'prefill'` or `'api'` |
| `PREFILL_FIELDS` | 1373 | What goes in the Signet URL. **Never add SSN/DOB** |
| `MAX_FILE_MB` / `MAX_FILES` | 1368 | Upload limits |
| `STATEMENTS_MIN` | ~1385 | Months of statements required. **4**, all states |
| `STATEMENTS_MIN_BY_STATE` | ~1386 | Per-state exceptions to that |
| `INDUSTRY_LABEL` | ~60 | Calculator industry code → application label |
| `LEAD_STORE_ENDPOINT` | ~45 | Our own submission store |
| `INDUSTRY_MULT` | 664 | John's real multipliers, set 18 Aug 2026 |
| `BALANCE_DEDUCTION_RATE` | 678 | Currently 1.0 |
| `RANGE_SPREAD` | 688 | Currently 0.15 |
| `CREDIT_MULT` | 692 | Credit band multipliers |
| `HELOC_MAX` | 970 | 750000 |
| `HELOC_RATES` | 972 | Rate by credit band |

Parallax accepts `?px=` / `?tune=1` overrides in the URL. Momentum accepts
`?ease=` / `?nomo=1`. Both are disabled under `prefers-reduced-motion` and at
≤680px, on purpose.

---

## 8. Traps that have already cost real time

**Testing in a background browser tab.** Chrome freezes `requestAnimationFrame`
in hidden tabs. I concluded parallax was broken three times in a row while
`visibilityState` was `"hidden"` and rAF had never fired. I was measuring my own
blind spot, told John the site was broken, and was wrong. **If you are checking
animation, confirm the tab is actually foregrounded.**

**Immutable cache headers.** `.htaccess` once served CSS/JS with
`max-age=31536000, immutable`, so returning visitors kept old files for up to a
year. Now `max-age=3600, must-revalidate` plus `?v=N`. Do not "optimise" it back.

**Figure's 400 does not mean malformed data.** Figure's own OpenAPI spec declares
`"400": Incorrect credentials` on that endpoint. I assumed a bad payload and
burned two rounds. Separately, `/pre-qualify/v2` accepts **only** JWE-encrypted
bodies and returns 400 on plain JSON — we use **v1** for that reason.

**Float serialization.** Figure rejects `250000.0`. Cast money fields to int.

**`>` vs `>=` on dropdown bands.** John said "above 650". The dropdown's
650–699 band reports `650`, so `credit > 650` silently excluded the whole band.
He found it, not me. Check what a control actually reports.

**The `hidden` attribute loses specificity fights.** `.field { display: grid }`
overrode `[hidden]`, so the signature pad rendered when it should not have. A DOM
test said hidden; the screenshot said otherwise. `[hidden] { display: none
!important; }` is now in the CSS. **Screenshot your work.**

**Per-scope validation misses cross-scope rules.** Ownership % was summed within
each step, so 100% owner + 50% co-owner passed. Validate against the whole form.

**301 redirect ordering.** The `/long-term-loans` → `/sba-loans` redirect must
sit **before** the clean-URL rewrite, or rule 4 rewrites to a deleted file and
404s.

**`.bullets li` is a two-column grid.** A `<b>` plus a bare text node become
separate grid items and the layout breaks. Wrap everything after the tick in one
`<span>`.

---

## 9. Credentials and security posture

**The repo is public.** This shapes everything.

| Secret | Where it lives |
|--------|----------------|
| Figure affiliate ID | `api/config.php` on the server only. Gitignored |
| altaFlow token | Not yet issued. Same file when it is |
| Google Apps Script URL | In `app.js` — it is a write-only endpoint, acceptable |

`.htaccess` denies `config.php`, `config.example.php`, `*.log`, and
`api/uploads/`. `api/uploads/` is also gitignored.

**A relative `application_dir` is refused.** Hit for real on 18 Aug 2026: the
value in `config.php` was missing its leading slash, so PHP resolved it against
the script directory and started building
`public_html/api/home/<user>/tmf-applications` — customer bank statements inside
the web root, with everything appearing to work. `application.php` now refuses
to run with a relative path and the self-check says so in plain words;
`lead.php` falls back to its protected default rather than losing an enquiry.
The self-check also warns when an absolute path still resolves inside
`DOCUMENT_ROOT`.

**Rules that must not be weakened:**

- Consent booleans (`privacyPolicyOptIn`, `remarketingAllowed`) pass through
  exactly as ticked, never defaulted to true. `api/figure-heloc.php` rejects any
  request lacking privacy consent.
- `api/application.php` strips any key containing `ssn`, `dob`, `birth`,
  `social`, `sig` or `signature` before writing anything to disk. Verified by
  posting an SSN to it deliberately.
- File type is decided by `finfo` on the actual bytes, never the filename. A
  `.exe` renamed `.pdf` is rejected — tested.
- Never put personal data in a query string.
- Never let a form claim a message was sent when nothing was transmitted.

**Do not accept credentials pasted into chat.** John offered a GitHub token once
and I declined; the affiliate ID was kept out of chat the same way. Anything
typed into a conversation is stored in that conversation. Point him at the config
file on the server instead.

---

## 10. Working style that suits this owner

- **He is not a developer.** When he asks how to do something in cPanel or
  GitHub Desktop, give numbered steps at a level a beginner can follow. He has
  asked more than once to be spoken to "like I am 10" — that is a real request,
  not a joke, and following it worked.
- **He judges by looking.** Ship something visible, then refine. He reported
  parallax "not working", then "not noticeable", then asked for it "more
  aggressive". Screenshots and a live test page settled it.
- **He finds real bugs.** The 650 threshold and the absurd 4K–92K range were both
  his catches. Take his reports seriously even when the code looks right.
- **Own mistakes plainly.** Saying "my last few checks were nonsense, I was
  measuring my own blind spot" landed better than hedging. He kept working with
  me after it.
- **Push back when it matters.** He asked for SSN collection on his own server; I
  built everything else and explained why not. State the reason once, clearly,
  and offer the path that gets him what he wants safely.

---

## 11. Immediate priorities

1. **Switch on the application encryption key.** `SETUP-APPLICATION.md`, step
   1 to 3. **Until John does this the application form accepts nothing** — it
   fails closed by design. This is now the highest-priority item by a distance.
2. **Push the commits** via GitHub Desktop, then deploy from cPanel.
3. **Get a phone number and email onto the site.** §6.2.
4. **Chase Figure** about `OFFERS` provisioning. §6.1.
5. **Settle the Signet ownership question.** §6.4.
6. **Identity collection — built 18 Aug 2026.** Superseded by John's decision
   to take the whole application in-house. See §5.3.

**Copy note:** `apply.html`'s handoff note used to promise the Signet page would
arrive "with everything above already filled in". That is false until the
pre-fill bot exists, so it was reworded on 18 Aug to be true in both states.
**Once Signet enables the bot, it is worth putting the "already filled in"
promise back** — that is the moment it becomes true and it is a real reassurance
at the handoff.

---

## 12. Companion documents in this repo

| File | Covers |
|------|--------|
| `README.md` | Quick orientation |
| `SETUP-LEAD-CAPTURE.md` | Google Sheets step by step |
| `SETUP-FIGURE-API.md` | Figure integration and the 500 |
| `SETUP-APPLICATION.md` | The application, encryption, the inbox |
| `SETUP-CHAT.md` | Live chat, the agent, and taking over |
| `google-apps-script.gs` | The script behind the leads sheet |
