# Connecting Figure's HELOC API

The HELOC calculator can pull real, personalised offers from Figure instead of
only showing our own estimate. The code is written and tested. It needs your
affiliate ID, which you add on the server — never in this repo.

**Do not paste your affiliate ID into a chat, a commit, or any file in this
repository.** `tmfus-clean` is a public repo. An ID pushed there is a leaked
credential and Figure would have to rotate it.

---

## Why there is a PHP file

Figure sends the affiliate ID in the **body** of the API request. If the
calculator called Figure directly from the browser, that ID would be visible to
every visitor in their developer tools, and anyone could spend your quota or
submit leads as you.

So `api/figure-heloc.php` sits on your server, holds the ID, and relays the
request. The browser never sees it. Your host runs LiteSpeed with PHP, so
there's nothing to install.

---

## Setup

### 1. Create the config file

On your server, in the `api/` folder, copy `config.example.php` to `config.php`.

You can do this in cPanel: **File Manager** → `public_html/api` → right-click
`config.example.php` → **Copy** → name it `config.php`.

### 2. Add your affiliate ID

Edit `config.php` and replace `PUT-YOUR-AFFILIATE-ID-HERE` with the ID Figure
gave you. It's a 36-character UUID.

### 3. Choose the environment

Start on test:

```php
'environment' => 'test',        // https://api.test.figure.com
```

When you're happy, switch to:

```php
'environment' => 'production',  // https://api.figure.com
```

### 4. Try it

Go to **tmfus.com/heloc-calculator.html**, fill the property and income fields
at the top, then complete the "See your actual rate from Figure" panel and
submit.

- **Offers appear** → you're live.
- **"Figure integration is not configured yet"** → `config.php` is missing, or
  still has the placeholder.
- **"Figure could not return offers"** → the API rejected it. Check
  `api/figure-errors.log` for the status code, and confirm with Figure that
  your ID is enabled for the environment you selected.

---

## What gets sent

From the calculator you already filled in: property value, mortgage balance,
monthly income, monthly debts, credit score.

From the new panel: name, email, phone, property address, loan purpose,
employment status, and the two consent boxes.

Anything Figure returns — rate, APR, line amount, monthly payment, term,
origination fee — is shown on the page, along with a **Continue with Figure**
button using the personalised link Figure supplies.

Every submission is also recorded in your leads spreadsheet under
`figure-heloc`, including how many offers came back and the best rate, so you
can see conversion without logging into anything.

---

## Two things worth checking with Figure

1. **Income period.** Your site asks for *monthly* income. Figure's
   `householdIncome` field is being sent as **annual** (monthly × 12). If Figure
   tells you they expect monthly, set `'income_is_annual' => false` in
   `config.php`. Getting this wrong skews the offers.

2. **Disclosures.** You are showing real credit offers on your own site. Figure
   returns disclosure text, which the page displays when present, and there's a
   fallback line otherwise. Confirm with Figure that what's displayed satisfies
   their partner requirements and your licensing model — that's a compliance
   question for them and your counsel, not something to guess at.

---

## Consent

The two checkboxes are passed through exactly as the visitor ticks them. The
privacy box is required and the server rejects any request without it. The
marketing box is optional and defaults to unticked.

Neither is ever defaulted to true in code. If you're tempted to pre-tick them
to lift conversion, don't — consent you didn't actually collect isn't consent.

---

## Safety built in

- The affiliate ID never reaches the browser
- `api/config.php` and `api/figure-errors.log` are gitignored
- Requests are capped at 20 per IP per hour (`rate_limit_per_hour`)
- Only known fields are forwarded; unexpected input is dropped
- Enum values are whitelisted, so junk can't be injected into the API call
- Error logs record status codes, never the affiliate ID and never SSN or DOB
