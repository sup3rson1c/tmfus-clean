# TMF Animation Sandbox

Throwaway replica of `../tmf-team`, created 2026-09-19 for experimenting with
animation. **Nothing here is wired back to the real project.**

- Source of truth for the real site stays in `D:\Desktop\Claude Code\tmf-team`.
- `node_modules/` is a directory *junction* to the real project's
  `node_modules` (read-only use — never `npm install` in here, it would write
  through to the original).
- Serve on port **3200** so it can't collide with the real site on 3000:
  `node serve.mjs 3200`
- Edit `src/` then run `node build.mjs` — `index.html` and the page folders
  are generated output.

## The funding film (added 2026-09-19)

Beats 1–3 of the 9-beat sequence, between the hero and the estimate section.

- `src/partials/home-film.html` · `src/css/10-film.css` · `assets/js/film.js`
- Keyframes `media/film/k1..k4.webp`, clips `media/film/clips/*.mp4`
- `node tools/film-frames.mjs` re-extracts the scroll frames — **the dev
  server must be running first** (`node serve.mjs 3200`); it decodes through
  Chrome because there is no ffmpeg here and npm install would write through
  the node_modules junction.
- Docs: `docs/film-phase1-uxplan.md`, `film-phase2-direction.md`,
  `film-phase4-audit.md`
