# TMF Team — website package

This is the full static site plus its sources.

## Run it

The pages use absolute paths (`/assets/...`), so opening `index.html` straight
from the file system will not load the styles. Serve the folder instead:

    node serve.mjs

then open http://localhost:3200

Any static server works — `python -m http.server 3200` from this folder is
fine too. Deploying to a web host: upload everything except `src/`, `tools/`,
`docs/` and `serve.mjs`; the site root is this folder.

## What's inside

    index.html, about/, apply/, calculator/, ...   the built pages
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
- The "$248,500" on the safe's screen is a placeholder figure.
- Phone number, email and address are placeholders.
