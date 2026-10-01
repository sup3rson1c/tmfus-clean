# TMF Team — website package

This is the full static site plus its sources.

## Run it

The pages use absolute paths (`/assets/...`), so opening `index.html` straight
from the file system will not load the styles. Serve the folder instead:

    node serve.mjs 3200

then open http://localhost:3200 (with no port argument it uses 3000). It
answers `/api/*.php` from `tools/api-mock.mjs`, so forms work without PHP, and
it sends the same Content-Security-Policy header the live `.htaccess` does.

Any static server works — `python -m http.server 3200` from this folder is
fine too, but has no API mocks and no CSP header. Deploying: see DEPLOY.md
(cPanel copies exactly the files listed in `.cpanel.yml`).

## Check it

    node build.mjs && bash scripts/verify.sh   # must pass before any PR

With `node serve.mjs 3200` running, the browser checks are:

    node tools/interact.mjs         # every form and flow, against the mocks
    node tools/audit.mjs            # accessibility and overflow, 1440/390px
    node tools/prelaunch-final.mjs  # every page, redirects, 404, opt-out

All three report Content-Security-Policy violations (report-only ones too) as
failures. To prove the policy would not break anything once enforced, start
the server with `CSP_ENFORCE=1 node serve.mjs 3200` and run them again.

## What's inside

    index.html, about.html, apply.html, ...       the built pages (served at
                                                  /about, /apply, ...)
    assets/css, assets/js, assets/img             what the pages load
    media/film/frames                             the scroll film (870 stills)
    media/film/clips                              the same film as video, for
                                                  the reduced-motion play button
    src/                                          page sources + CSS sources;
                                                  edit these, then `node build.mjs`
    api/                                          PHP endpoints (config.php not included)
    docs/                                         build notes and the asset log

## Notes

- The funding film is scroll-scrubbed: scrolling the pinned section is the
  playhead. On a reduced-motion setting it becomes a film you press play on.
- The funded total on the safe's screen counts up to $999,999 (`TARGET` in
  `assets/js/film.js`). It is an illustrative figure, not a real deal.
- Contact details, as published in `src/` today:
  - Address: 550 S Andrews Ave, Fort Lauderdale, FL 33301 (privacy policy,
    terms, and the Organization schema in `build.mjs`).
  - Email: privacy@tmfus.com (privacy requests) and legal@tmfus.com (legal
    notices), on the privacy and terms pages only. Both mailboxes must exist
    in cPanel before launch. There is no general email address: everyone else
    is sent to the contact form, which posts to `api/lead.php`.
  - Phone: none. No number is published anywhere on the site and the schema
    has no `telephone`, on purpose; do not add one until TMF has a real one.
  - Hours: Mon–Fri, 9am–6pm EST (footer, contact page, header menu, apply).
- Security headers live in `.htaccess`. The Content-Security-Policy block in
  it is written by `build.mjs` (policy and inline-script hashes are defined
  there), so edit `build.mjs`, never that block.
