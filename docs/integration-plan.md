# Integrating the live tmfus.com systems

Started 2026-09-20, from `tmfus-site-changes-v43.zip`.

Decisions taken: build now and add keys later; port the backend of everything;
keep this design unless it harms functionality; run on localhost for now but
stay deployable to the existing cPanel host.

## What the zip actually contained

Not the full site — a changed-files backup from the 8 September 2026 session,
20 files. Present: 12 page templates, `assets/app.js` (128KB), `assets/styles.css`
(77KB), `api/chat.php`.

**Missing, and needed:**

| file | holds |
|---|---|
| `api/config.php` | every credential, including the Figure HELOC keys. Server-only by design |
| `api/figure-heloc.php` | the HELOC quote endpoint |
| `api/application.php` | application intake and file uploads |
| `api/lead.php` | lead storage |
| `api/unsubscribe.php` | opt-out handling |

No credentials are in the zip. Everything reads from `$cfg`, which
`chat.php:573` loads from `api/config.php`.

## Approach

`app.js` is hook-driven — it binds to `data-field`, `data-calc`, `data-step`
and friends rather than to specific markup. So the engine is kept **as the
vendored original** and this design supplies the same hooks. That way their
logic stays the source of truth and upstream changes can be re-vendored
without redoing the design work.

- `vendor/tmfus/` — the untouched originals, for reference and diffing.
- `api/` — the PHP that ships to cPanel.
- `api/config.sample.php` — every config key, extracted from the code that
  reads it. Copy to `config.php` on the server and fill in.
- `api/config.php` is in `.gitignore` and must never be committed.

Their `styles.css` is **not** loaded. It would fight this design, and the
brief is to keep the design. It stays in `vendor/` so any behavioural CSS the
JS depends on (`is-open`, `is-active`) can be found and reimplemented.

## Running locally without PHP

There is no PHP on this machine, so `tools/api-mock.mjs` answers the same
URLs from the dev server with responses shaped like the real ones. The front
end takes the identical code path it will take in production.

Mocked: `lead.php`, `application.php`, `figure-heloc.php`, `unsubscribe.php`,
`chat.php`. Each logs what it received. **Nothing is forwarded** — in
particular, posted leads are logged and dropped rather than sent to the live
Google Apps Script endpoint hardcoded in `app.js:35`.

The mocks live only in `serve.mjs`. On cPanel the real `api/*.php` answer.

## Page mapping

| live page | this design | state |
|---|---|---|
| index.html | `/` | designed |
| apply.html | `/apply/` | designed shell, no logic yet |
| funding-estimator.html | `/calculator/` | designed shell, no logic yet |
| heloc-calculator.html | `/home-equity/` | designed shell, no logic yet |
| mca.html | `/cash-injection/` | designed |
| sba-loans.html | `/sba-loans/` | designed |
| about, contact, privacy, terms | same | designed |
| unsubscribe.html | — | **to build** |
| 404.html | — | **to build** |

The sandbox's `apply.js` and `calculator.js` make no network calls at all —
they are presentation shells, so all real behaviour comes from `app.js`.

## Order of work

1. Foundation — vendor, config template, mocks. **Done.**
2. Funding estimator + MCA calculator. Entirely client-side, so it works
   locally end to end.
3. Application. Largest piece: multi-step, validation, uploads.
4. HELOC. Needs `figure-heloc.php`; runs against the mock until then.
5. Cross-page plumbing — lead capture, visitor memory, consent, chat.
6. `unsubscribe` and `404`.

## Open

- The Figure config key names in `config.sample.php` are inferred from the
  naming of the other integrations, since the file that defines them was not
  in the zip. Confirm against the live server.
- `app.js:35` hardcodes a live Google Apps Script lead endpoint. It is
  client-side by necessity, but decide whether it should stay in the new build
  or be proxied through `lead.php`.


## Done — 2026-09-29

All six steps finished. See the top of `/CLAUDE.md` for the result: the live
URLs, the generated engine, the calculator on the engine's formula, the full
application, contact, HELOC hand-off, legal pages, unsubscribe, 404, chat,
cookie consent, the PHP backend and admin inbox copied from the live repo, and
the live `verify.sh` ported and passing. The "missing" PHP listed above was in
the live repo all along (`C:\Knowledge Work	mfus-sitepi`); only
`config.php` is server-only, as designed. `config.sample.php` (inferred keys)
was replaced by the live `config.example.php`.
