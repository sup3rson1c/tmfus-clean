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

Replace `YOURUSER` with your cPanel username. Putting this **outside**
`public_html` matters — these are Social Security numbers and bank statements,
and the web server should not be able to serve them at all. If you leave the
default it falls back to `api/uploads/`, which is blocked three separate ways,
but that is a second line of defence rather than a first.

`application_notify` is where the "new application" email goes. That email
contains a reference number and the business name only, on purpose.

### 4. Test it yourself before you advertise it

Fill in your own application on the live site with made-up numbers. You should
get a reference back. Then do step 5 and open it. If anything fails the form
tells you rather than pretending it worked.

### 5. Reading an application

1. The notification email gives you a reference and a folder path
2. cPanel → File Manager → that folder → download `application.enc.json`
3. Open `tmf-application-tool.html`, load your private key and that file
4. Press **Open it**

The whole application appears, signature included. There is a Print / Save as
PDF button if you need a copy for a funder.

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
