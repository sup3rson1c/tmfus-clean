# The application — how it works and how to switch it on

TMF collects the whole application itself. There is no handoff to another
company, no second form, and nothing about the applicant travels in a URL.

**This will not accept a single application until you do the steps in
"Switching it on" below.** That is deliberate: without an encryption key the
endpoint refuses submissions rather than storing Social Security numbers in the
clear. Do the setup before you send anyone to the page.

---

## What the applicant sees

| Step | What it asks for |
|------|------------------|
| 1 | Business legal name, DBA, EIN, address, city, state, zip, start date, industry |
| 2 | Owner name, ownership %, home address, city, state, zip, email, phone, **date of birth, SSN**, amount wanted |
| 3 | Co-owner — optional, same fields including date of birth and SSN |
| 4 | Bank statements, the credit authorization, consent boxes, **signature**, submit |

Everything validates before the next step unlocks: EIN length, real calendar
dates that cannot be in the future, a ten-digit phone, a working email, and
ownership that adds up across **both** owners rather than per step. The
signature box must actually be signed.

At the end they get a reference number. Nothing else is asked of them.

---

## What happens to the data

```
browser  ──HTTPS──▶  api/application.php  ──▶  encrypted file on your server
                             │
                             ├──▶  summary.json     (no SSN, no DOB, no signature)
                             ├──▶  bank statements  (outside public_html)
                             └──▶  email to you     (reference + business name only)

                     leads spreadsheet  ◀── ordinary fields only, never the sensitive ones
```

The sensitive half — Social Security numbers, dates of birth, the signature
image — exists in exactly one place: inside `application.enc.json`, encrypted.
It is never emailed, never put in the leads sheet, never written to disk in
readable form, and never placed in a URL.

### How the encryption works

Each application gets a fresh AES-256-GCM key. That key is sealed with an RSA
public key held on your server. The matching **private** key never goes on the
server — it lives on your own computer. So someone who steals the entire
hosting account gets a pile of ciphertext and no way to read any of it.

This is verified, not assumed. A full round trip was tested on 18 Aug 2026: a
real submission through `api/application.php`, encrypted on disk, then opened in
the browser tool. The stored files were also searched for the test SSN and it
does not appear anywhere in plaintext.

`scripts/crypto-chain-test.mjs` re-runs the whole chain — seal an envelope the
way `application.php` does, wrap a private key the way `admin.php` does, unlock
it with the admin password, decrypt — and `verify.sh` runs it. If you change
anything in the chain, that test tells you before an applicant does.

Each sealed envelope also carries a `key_id`, a short code derived from the
**public** key. It is not a secret. It exists because the only failure that has
ever happened here is a key mismatch, and comparing two codes answers it in
seconds.

---

## Switching it on

Once, about ten minutes.

### 1. Make your key pair

Open **`tmf-application-tool.html`** on your own computer — double-click it and
it opens in your browser. It never connects to the internet.

Press **Create my key pair**. You get two things:

- a **public key** shown in a box, with a Copy button
- a **private key**, via the Download button

Save the private key file somewhere you will not lose it, and back it up.
**If you lose it, every application encrypted with it becomes permanently
unreadable — by you, by us, by anyone.** If someone else gets it, they can read
every application you have ever received. Do not email it. Do not put it on the
website. Do not put it in GitHub.

### 2. Put the public key on the server

In cPanel, open **File Manager**, go to `public_html/api/`, and edit
`config.php`. If `config.php` does not exist yet, copy `config.example.php` to
`config.php` first.

Find this line:

```php
'application_pubkey' => '',
```

Paste your public key between the quotes. It is fine for it to span several
lines. Save.

### 3. Point the storage somewhere outside the website

In the same file:

```php
'application_dir'    => '/home/YOURUSER/tmf-applications',
'application_notify' => 'you@tmfus.com',
```

Replace `YOURUSER` with your cPanel username — your real one, which is on the
cPanel home page in the right-hand panel next to "Username".

**Keep the leading slash.** `/home/you/tmf-applications` is an absolute path;
`home/you/tmf-applications` is a relative one, and the server would resolve it
against `public_html/api/` — putting customer bank statements inside your
website while appearing to work perfectly. The endpoint now refuses to run with
a relative path and the self-check names the problem, but it is worth knowing
why that one character matters.

Putting this **outside** `public_html` matters — these are Social Security numbers and bank statements,
and the web server should not be able to serve them at all. If you leave the
default it falls back to `api/uploads/`, which is blocked three separate ways,
but that is a second line of defence rather than a first.

`application_notify` is where the "new application" email goes. That email
contains a reference number and the business name only, on purpose.

### 4. Check the setup from your browser

Go to:

```
https://tmfus.com/api/application.php?selftest=1
```

You get a short plain-English report. `"verdict": "Ready. The application form
will accept submissions."` means you are done. Anything else names the exact
problem — a missing `config.php`, a key still set to the placeholder, the
private key pasted in by mistake, or a storage folder that cannot be written to.

It never shows the key, the storage path or any applicant data, so it is safe to
leave enabled and safe to open on your phone.

**Key formatting is handled for you.** Web-based file editors routinely eat the
line breaks in a pasted key. The server now repairs that automatically — headers
missing, all on one line, literal backslash-n, Windows line endings, indented by
the editor. Nine mangled forms were tested and all nine are rebuilt into a valid
key. You do not need to get the paste perfect; you only need the right key.

### 5. Test it yourself before you advertise it

Fill in your own application on the live site with made-up numbers. You should
get a reference back. Then do step 6 and open it. If anything fails the form
tells you rather than pretending it worked.

### 6. Reading applications — the inbox

Add one more line to `api/config.php`:

```php
'admin_password' => 'four or five unrelated words work well',
```

Then go to **https://tmfus.com/admin.php** and sign in. You get every
application and every calculator or contact submission in one list, searchable,
newest first. Click an application to read it in full.

**Signing in is the only step.** Type your admin password, and every
application is readable. There is no second password and nothing to click.

The server still hands your browser the sealed file and your browser opens it.
The key never goes to the server, and the server could not read an application
if it wanted to.

#### Setting up a computer, the first time only

Do this once on each computer you want to read applications on.

1. Sign in at **https://tmfus.com/admin.php**.
2. A box appears saying *Set this computer up, once*.
3. Click **Choose your private key file** and pick your `tmf-private-key.pem`.
   You should see: *Key file read ✓*.
4. Click **Remember this key on this computer**.
5. It asks for your admin password one time. Type it and press OK.
6. The label at the top right should now say **Unlocked**.

Now put the key file somewhere safe and offline — a USB stick in a drawer, or a
password manager. **Take it out of your Downloads folder.**

#### Every time after that

1. Sign in at **https://tmfus.com/admin.php**.
2. Open any application.

That is the whole of it. It re-locks after 20 minutes with nothing happening,
and when you sign out.

#### The buttons you might need

- **Show** — Social Security numbers and dates of birth stay covered until you
  click Show, so nobody reads one over your shoulder. Printing uncovers them
  automatically.
- **Lock** (top right) — closes everything without signing out.
- **Set up / unlock** (top right, when locked) — opens the setup box.
- **Forget the key stored on this computer** — removes the key from that
  browser. Use it on a computer you are giving up. Nothing on the server changes
  and no application is lost.
- **Just use the file this once** — for somebody else's computer, where storing
  the key would be the wrong thing to do.

#### If you change your admin password

The key on each computer is scrambled with the old password, so it will not
open any more. The page tells you so and asks for your key file again. Redo
steps 3 to 5 above on each computer. Nothing is lost.

**This is the one reason to keep the key file.** If you lose the key file *and*
change your admin password, every application already received becomes
permanently unreadable. Nobody can recover it — not TMF, not the host, not
Anthropic. That is the same property that makes a stolen server useless to a
thief.

#### How one password can do both jobs

When you set a computer up, the private key is scrambled using your admin
password (PBKDF2 at 310,000 rounds, then AES-256-GCM) and kept in that browser.
When you sign in, the login page unscrambles it right there, before the page
even submits, and hands the opened key to the inbox page.

Your password is never stored anywhere. What gets handed over is the opened key
in a form the browser will use for decryption but **will not hand back as
readable bytes** — not to the page, not to anything. That was tested in a real
browser, not assumed.

**The honest trade-off:** the server does see your password when you sign in,
because that is how signing in works. It does not see the scrambled key, which
never leaves your computer. An attacker needs both, from two different places.
The alternative — putting the private key on the server — would mean one
break-in hands over every Social Security number TMF holds. That is why it is
done this way.

**The real gap, and it is not this one:** `admin.php` has a password and no
second factor. The FTC Safeguards Rule expects multi-factor authentication for
anyone reaching customer information. Worth fixing; ask when you want it.

There is a Print / PDF button for sending a file to a funder, and the leads tab
has a one-click CSV download for the month.

**What a stolen admin password would expose:** names, businesses, emails, phone
numbers and bank statements. Not Social Security numbers, dates of birth or
signatures — those stay sealed regardless. Use a long password. That trade is
the price of not living in cPanel, and it was made deliberately.

The page refuses to open at all if there is no password set, if it is reached
over plain HTTP, or if `application_dir` is not configured properly.

### 6b. The offline tool still works

`tmf-application-tool.html` does the same job without the website being
involved: download `application.enc.json` from cPanel, open it there, load the
key file. Keep it — it is the fallback if the site is ever down, and it is where
you generate and regenerate your key pair. Day to day you should not need it:
the inbox is the everyday route now.

---

## Bank statements are required

John's rule, 18 Aug 2026: an application cannot be submitted without bank
statements, and the requirement is **four months in every state**. It lives at
the top of the application section of `assets/app.js`:

```js
const STATEMENTS_MIN = 4;
const STATEMENTS_MIN_BY_STATE = {
  // 'FL': 3,
};
```

To make one state different, add its two-letter code to the exceptions list with
the number of months it needs. Everything else follows — the dropzone headline,
the hint under it and the error message all read from those two values. The
count is chosen by the **business** state, and the wording updates the moment
the applicant reaches step 4, so nobody uploads three and is then told they need
four.

Worth watching: statements used to be optional, with an advisor emailing a
secure upload link later. Requiring them up front is stricter and will lose some
applicants who do not have the files to hand at that moment. That is a
deliberate trade — better-qualified applications, fewer of them. If drop-off at
step 4 looks bad, this is the first thing to revisit.

---

## Where every submission is stored

Since 18 Aug 2026 nothing relies on the Google Sheet alone. Every form on the
site — both calculators, the contact form and the application — also posts to
`api/lead.php`, which writes to disk you control:

```
<application_dir>/leads/YYYY-MM/leads.csv                  every submission, one row
<application_dir>/leads/YYYY-MM/<time>_<kind>_<id>.json    the full record
```

**To see them:** cPanel → File Manager → your `tmf-applications` folder →
`leads` → this month → download `leads.csv` and open it in Excel. It has a
column each for the name, business, email, phone and state, plus a `details`
column holding whatever else that particular form collected.

The Sheet still gets a copy. The difference is that the Sheet is posted
`no-cors`, so the browser can never see whether it arrived, while `lead.php`
answers properly — which is why the contact form can now honestly say whether a
message was stored.

`lead.php` refuses to write anything whose field name looks like an SSN, date of
birth or signature, and logs it loudly if such a thing ever arrives. Those exist
only inside the encrypted application envelope. Verified by posting an SSN to it
deliberately and grepping the whole lead store for it afterwards.

**Applications are not in the CSV.** Only their non-sensitive summary is. The
full application is the encrypted file, read with the tool.

---

## Answers carry across the site

Someone who runs a calculator and then applies should not type their name twice.
What a visitor enters in any form is kept **in their own browser**
(`localStorage`, key `tmf_visitor_v1`) and used to pre-fill the application:
business name, owner name, email, phone, industry, city, state, zip.

- It only ever fills fields that are **empty** — it cannot overwrite something
  the applicant typed.
- A notice at the top of step 1 tells them what was carried over and asks them
  to check it, rather than silently putting words in their mouth.
- Sensitive fields are not eligible and were never stored there in the first
  place.
- The calculators use short industry codes (`restaurant`) and the application
  uses full labels (`Restaurant / Food service`). `INDUSTRY_LABEL` in `app.js`
  maps between them. **Add an option to either list and you must add the pairing
  there**, or the industry silently fails to carry across.

---

## Things worth knowing

**The authorization text names TMF Team.** It was changed from Signet Capital
Group on 18 Aug 2026, because the applicant now authorizes *you* to pull their
credit. It reads "TMF Team, its assigned agents, and affiliates", so you can
still pass a file to a funding partner. The exact wording carries an id
(`tmf-auth-2026-08`) stored with every signature, so you can always prove which
version somebody agreed to. **If you change a word of that text, change the id
too.**

**The signature is a canvas drawing.** It is captured as an image and stored
with the applicant's IP address, the timestamp, the user agent and the id of the
authorization wording. That is a reasonable audit trail for an application and a
credit-pull authorization. It is still weaker than a dedicated e-signature
platform would be for a **funding contract** — if you ever move contracts onto
your own site too, that is the point to get a lawyer's view rather than reuse
this.

**You are now holding Social Security numbers.** That brings obligations under
the FTC Safeguards Rule that did not apply while Signet held the data. The
encryption here is a large part of what that rule asks for, but not all of it —
it also expects a written security policy, limits on who can access the data,
and a plan for what happens if there is a breach. Worth an hour with someone who
does compliance for brokers.

**Retention.** Nothing deletes applications automatically. Encrypted files pile
up in `application_dir` forever. Decide how long you want to keep them and clear
out old ones periodically — the safest data is the data you no longer hold.

---

## Configuration reference

`api/config.php`, copied from `config.example.php`, never committed to git:

```php
'application_dir'    => '/home/YOURUSER/tmf-applications',  // outside public_html
'application_notify' => 'you@tmfus.com',                    // '' switches email off
'application_pubkey' => '-----BEGIN PUBLIC KEY----- …',     // REQUIRED
```

`application_pubkey` also accepts a path to a `.pem` file instead of the key
itself, if you would rather keep it separate.

---

## For whoever maintains this next

- Encryption lives in `sealEnvelope()` in `api/application.php`. It uses
  RSA-OAEP with a **SHA-1** label hash — not an oversight. PHP's
  `openssl_public_encrypt` with `OPENSSL_PKCS1_OAEP_PADDING` emits SHA-1 and
  offers no way to change it, so the browser tool is set to match. OAEP does not
  depend on that hash resisting collisions. Change it on one side and every
  future application becomes unreadable.
- The tool and the endpoint must always agree on the envelope format:
  `sealed_key`, `iv`, `tag`, `data`, all base64. WebCrypto expects the GCM tag
  appended to the ciphertext; PHP returns it separately, which is why the tool
  concatenates them.
- `api/application.php` fails closed when there is no usable public key. Do not
  "fix" that by removing the check.
- The success pane is shown **only** after the server confirms it stored the
  application. Never restore a version that shows a receipt optimistically.
- The signature is recoloured black and flattened onto white before export. The
  pad draws white-on-dark to match the theme; exported as-is it is invisible in
  every viewer John will actually open it in.
