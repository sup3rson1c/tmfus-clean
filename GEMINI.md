# GEMINI.md — tmfus.com (same as AGENTS.md)

Every AI working on this repo reads **`CLAUDE.md`** first. It is the full
rulebook for this site: how the build works, what must never change, and how
to talk to John. This file only adds the team workflow.

## Team workflow (from 30 Sep 2026)

- **Claude (John's main session) is the boss.** It writes the issues, reviews
  every pull request and merges.
- **The work branch is `redesign-2026`.** Branch from it and open your pull
  request **into `redesign-2026`**, never into `master`. `master` is what the
  live site deploys. It changes only when the boss merges the finished redesign
  and John presses Deploy in cPanel.
- Find work: `gh issue list -R sup3rson1c/tmfus-clean --label agent:<you> --label status:ready`.
  Claim it with a comment and move it to `status:doing`. One issue per branch,
  named `<you>/<issue>-<short-name>`.
- **Edit `src/`, never the root `*.html`.** Then run `node build.mjs` and commit
  the built files too.
- Before you push: `node build.mjs && bash scripts/verify.sh` must end with
  "All invariants hold". GitHub runs the same check, with PHP, on every PR.
- The local server is `node serve.mjs 3200` → http://localhost:3200. It mocks the API.
- Never commit `api/config.php`, and never invent phone numbers, addresses,
  testimonials or statistics (see CLAUDE.md).
