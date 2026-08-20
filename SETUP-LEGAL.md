# Terms, privacy, cookies — what exists and what you still have to do

Added 20 Aug 2026. Two new pages, a cookie banner, and consent wording on every
form that collects anything.

**Read the section "Five things only you can do" first.** Until those are done
the pages are a draft, and `verify.sh` will keep saying so on purpose.

---

## What was built

| Where | What it is |
|---|---|
| `terms.html` → `/terms` | Terms of Use and Service Agreement. 21 sections. |
| `privacy.html` → `/privacy` | Privacy Policy. The cookie policy is section 6, the opt-out form is section 8. |
| Footer, every page | Links to both, a Cookie settings link, a Do Not Sell link, and the broker disclosure. |
| Cookie banner | Built by `initConsent()` in `assets/app.js`. Appears on every page. |
| `apply.html` step 4 | The authorization text now covers sharing. Its id is `tmf-auth-2026-08b`. |
| Calculator step 3, contact form | One line above the button saying what you agree to by pressing it. |

---

## The part you actually asked for: sharing the information

You wanted to be able to pass what you gather to anyone in the industry. That is
now written down properly rather than assumed, in three places that have to
agree with each other:

1. **Terms section 7** lists exactly who your information can go to — funders,
   lenders, banks, other brokers, ISOs, syndicators, marketing partners,
   verification services, affiliates — and says plainly that TMF may be paid for
   it.
2. **Privacy section 5** says the same thing in the document a regulator reads
   first, and admits that under California law this counts as a "sale" and as
   "sharing". Saying so is what makes it legal. Hiding it is what makes it a
   fine.
3. **The application's authorization box** is what the applicant actually
   signs, so the permission is captured with a signature, a timestamp, an IP
   address and the id of the exact wording — `tmf-auth-2026-08b`.

Two guardrails were kept deliberately, and you should keep them:

- **Social Security numbers, dates of birth and signatures are never shared with
  a marketing partner** — only with a funder, lender or verification service
  working on that applicant's actual file. Selling those is a different category
  of legal problem, and the documents promise we do not.
- **Anyone can opt out** at `/privacy#do-not-sell`. The form switches their
  cookies off immediately and files a request that reaches your leads inbox as
  kind `do-not-sell-request`. **You have to action those within 15 business
  days.** Watch for them.

If you change the sharing wording, change the id on the authorization box too
(`data-consent-text-id` in `apply.html`) — it is how you prove later which
version somebody agreed to.

---

## Five things only you can do

`verify.sh` fails on the last check until the first three are done. That is
deliberate: a privacy policy with a blank where the address goes is not a
privacy policy.

1. **Your registered legal entity name.** The exact name on the company
   registration, e.g. "TMF Team LLC". Goes in `terms.html` section 1.
2. **A business mailing address.** Goes in `terms.html` section 21 and
   `privacy.html` section 15. It is also what CAN-SPAM requires at the bottom of
   any marketing email you send.
3. **The state whose law governs.** Normally where the business is registered.
   Goes in `terms.html` section 18, and the arbitration clause in section 17
   points at it.
4. **Create two email addresses** and point them at your inbox:
   `privacy@tmfus.com` and `legal@tmfus.com`. Both are quoted throughout the
   documents. In cPanel: Email Accounts → Create, or Forwarders if you would
   rather they land in your normal mail.
5. **Have a lawyer read both pages.** These are written to industry standard and
   they are specific to what TMF actually does, but they were not written by an
   attorney and they have not been reviewed by one. The arbitration clause, the
   class-action waiver and the sharing consent are the three worth paying for an
   hour on.

Tell whoever is editing the site the first three and they can fill them in — the
places are marked **TO BE COMPLETED** in the text.

---

## The cookie banner

Nothing that tracks anybody loads until the visitor says yes.

- **Necessary** is always on: the consent record itself, the chat session, and
  the calculator answers kept on their own device.
- **Analytics** is off until accepted. It switches on the first-touch campaign
  cookie (`tmf_attr`), and Google Analytics if you ever add an id.
- **Advertising** is off until accepted. It would switch on a Meta pixel if you
  ever add an id.

### Adding Google Analytics or a Meta pixel later

Find this near the top of the cookie section in `assets/app.js`:

```js
const TAGS = { ga4: '', metaPixel: '' };
```

Put your measurement id between the quotes — `'G-XXXXXXXXXX'` for GA4. Then bump
`?v=` on the asset links in every HTML page or nobody sees the change. Nothing
else needs doing: the loader only ever runs after consent, and Google Consent
Mode is set from the visitor's choice.

Do **not** paste a Google or Meta snippet into the HTML. It would load before
the visitor was asked, which is the exact thing the banner exists to prevent —
and `verify.sh` will catch you.

### Global Privacy Control

Some browsers send a signal meaning "do not sell or share my data". California
law treats it as a binding opt-out. The site honours it automatically: those
visitors get analytics and advertising off and never see the banner. They can
still turn things on by hand from the Cookie settings link.

---

## What you now collect that you did not before

Every form submission carries the campaign that produced it:

```
utm_source, utm_medium, utm_campaign, utm_term, utm_content,
gclid, gbraid, wbraid, fbclid, msclkid, ttclid,
referrer, referrer_domain, landing_page
```

Each appears twice — once bare for the visit that converted, and once with a
`first_` prefix for the campaign that first brought them to the site. They show
up in the `details` column of the monthly leads CSV.

No name, email or phone number is ever put in a cookie. The cookies hold
campaign tags and the consent choice, nothing else.

---

## Still not done, and it is a real gap

**A retention policy.** Nothing deletes anything. Applications, leads, chat
transcripts and now opt-out requests accumulate for ever, and TMF holds Social
Security numbers. The privacy policy says information is kept "as long as we
need it", which is true but vague, and vague is where the next problem comes
from. Decide a number — 7 years for funded files and 24 months for dead leads is
a common shape — and it can be built.

**The FTC Safeguards Rule.** The encryption covers a large part of what it asks
for. A written security policy, a named person responsible, access limits and a
breach response plan are not built and cannot be built by a website.
