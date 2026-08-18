# The application — what is live, and the one thing Signet has to switch on

## What is live now

`apply.html` is a four-step application in the site's own theme. It mirrors the
Signet document field for field, then hands the applicant to Signet with
everything already filled in.

| Step | What it asks for |
|------|------------------|
| 1 | Business legal name, DBA, EIN, address, city, state, zip, start date, industry |
| 2 | Owner name, ownership %, home address, city, state, zip, email, phone, amount wanted |
| 3 | Co-owner — optional, same eight fields, only appears if the applicant asks for it |
| 4 | Bank statements, the Signet authorization text, consent boxes, submit |

Everything validates before the next step unlocks: EIN length, real calendar
dates that cannot be in the future, a ten-digit phone, a working email, and
ownership that adds up across **both** owners rather than per step.

Bank statements go to `api/application.php`, which checks the actual bytes of
each file rather than trusting its name, and writes them to a folder the web
server refuses to serve.

---

## The one thing that is not switched on yet

**Signet has to add a pre-fill bot to the flow. It takes one person about ten
minutes and needs no API key.**

Here is what was tested on 18 August 2026 against the live link.

Opening `https://alfw.at/m7l8kpNQ6?business_city=Miami` lands on
`signetcapitalgroup.altaflow.com` with the URL rewritten to:

```
...&proxy_params%5Bbusiness_city%5D=Miami&role_order=1...
```

So altaFlow **does** carry query-string values into the document session, as
`proxy_params[name]`. That is the pre-fill mechanism, and it is already working.

What it does not do on its own is put those values into fields. The document
still reported **0 of 29 fields filled**. Mapping `proxy_params` onto fields is a
setting on the flow, and only a Signet altaFlow admin can add it.

### What to ask Signet for

> On the flow `SignetCapitalGroupApplicationBlank`
> (id `5CCBCD60-9A00-0000-0000BA29`), please add a pre-fill bot that maps
> incoming `proxy_params` to the document fields, using the names below.
> We are sending them on the public application link so applicants do not
> retype what they have already given us.

| Send this param | Into this field |
|-----------------|-----------------|
| `business_legal_name` | Business Legal Name |
| `business_dba_name` | Business DBA Name |
| `ein` | EIN |
| `business_address` | Business Physical Address |
| `business_city` | Business City |
| `business_state` | Business State |
| `business_zip` | Business Zip Code |
| `business_start_date` | Business Start Date |
| `industry` | Industry |
| `owner_name` | Full Name |
| `owner_ownership_pct` | Ownership % |
| `owner_address` | Home Address |
| `owner_city` | City |
| `owner_state` | State |
| `owner_zip` | Zip Code |
| `co_owner_name` | Co-Owner Name |
| `co_owner_ownership_pct` | Co-Owner Ownership % |
| `co_owner_address` | Co-Owner Home Address |
| `co_owner_city` | Co-Owner City |
| `co_owner_state` | Co-Owner State |
| `co_owner_zip` | Co-Owner Zip Code |

**Nothing breaks while you wait.** Until the bot exists the params ride along
harmlessly and the applicant fills the Signet page as they do today. The moment
Signet switches it on, 21 of the 29 fields arrive pre-filled. No change needed
on this site.

---

## Why SSN, date of birth and signature are not on that list

Those three are not collected on tmfus.com, and they are not in the URL.

Query strings are written to server logs, browser history, referrer headers and
any analytics tool in the path. A Social Security number in a URL is a Social
Security number in half a dozen log files, on machines nobody audits. Same for a
date of birth. So they cannot travel that way — not as a setting, not as an
option.

The signature is a separate point. An e-signature is only worth anything if
there is an audit trail behind it: who signed, from what IP, at what time, with
what document hash. altaFlow produces that. A canvas drawing captured on a
marketing site does not, and if a merchant ever disputes a contract, that
difference is the whole argument.

So the applicant enters those three on the Signet page, which takes about
fifteen seconds, and the signature stays legally defensible.

### If you want them collected here anyway

The code path is written and waiting on one credential.

1. Get a bearer token from a Signet altaFlow admin (`developers.altaflow.com`).
2. Put it in `api/config.php` as `altaflow_token`.
3. Change one line at the top of `assets/app.js`:
   ```js
   const APPLICATION_MODE = 'api';     // was 'prefill'
   ```
4. Bump `?v=` on the asset links in every HTML file.

The date-of-birth, SSN and signature fields un-hide themselves, the signature
pad becomes required, and they post to the server rather than the URL. Tested in
both modes.

Read the trade-off before you flip it: in `api` mode those values pass through
your own server. `api/application.php` is written never to write them to disk —
it strips any key containing `ssn`, `dob`, `birth`, `social`, `sig` or
`signature` before anything is saved, verified by posting an SSN to it
deliberately. But the signature's audit trail is still weaker than altaFlow's.

---

## Configuration

In `api/config.php` (copy from `config.example.php`, never committed):

```php
'application_dir'    => '/home/YOURUSER/tmf-applications',  // outside public_html
'application_notify' => 'you@tmfus.com',                    // '' switches email off
```

If `application_dir` is left at the default, the statements land in
`api/uploads/`, which is blocked three ways: a `RedirectMatch 404` in
`.htaccess`, a generated `Require all denied` inside the folder, and `0700`
permissions. **Moving it outside `public_html` is still better** — those are
customer bank statements, and the first line of defence should not be a config
file the next person might edit.

`api/uploads/` is in `.gitignore`. Never commit it.

---

## Still open

- **Whose account is this?** The application belongs to **Signet Capital Group**,
  not TMF Team. Sending applicants into it from tmfus.com should be agreed with
  Signet — the same question that is still open on the Figure affiliate ID.
- **No phone number or email anywhere on this site.** The contact page has hours
  and response times but no way to reach a human directly. This has been flagged
  several times; a business-funding site without a phone number costs conversions.
