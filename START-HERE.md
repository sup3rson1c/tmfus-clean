# Start here — opening a new Claude session on this project

This folder is a complete, self-contained handoff. A fresh Claude account needs
nothing from the old conversation.

---

## Step 1 — upload the folder

Unzip `tmfus-tmf-team-v26.zip` and give Claude the whole folder. Not just one
file — the handoff depends on Claude being able to read the code beside the docs.

- **Claude desktop app (Cowork):** connect the folder, or drag the zip in.
- **Claude Code:** `cd` into the folder and start a session there.
- **claude.ai chat:** attach the zip, plus `TMF-WEBSITE-HANDOFF.md` separately so
  it is read first.

---

## Step 2 — paste this as your first message

> I am John. This is the tmfus.com website — a lead-generation site for TMF Team,
> my US business-funding brokerage. I am not a developer; I deploy by clicking
> buttons in cPanel.
>
> Read `TMF-WEBSITE-HANDOFF.md` in full before doing anything. It assumes no
> prior context and covers the stack, the deploy pipeline, what is already
> working, what is blocked and why, and a list of traps that have already cost
> previous sessions real time.
>
> Two things that matter before you touch anything:
>
> 1. **Do not add a framework, bundler or npm.** This site is deliberately plain
>    static HTML, CSS and JS plus two PHP files. That is the right architecture
>    for me, not an oversight.
> 2. **The GitHub repo is public.** Never commit a credential, and do not ask me
>    to paste one into chat.
>
> When you have read it, tell me in a few sentences what state the project is in
> and what you think the highest-value next step is. Do not start changing files
> until we have agreed on that.

---

## Step 3 — what to expect back

A session that has actually read the handoff should be able to tell you, without
being asked:

- assets are at `?v=26` and the version must be bumped on every CSS/JS change
- the commits have never been pushed
- the Figure 500s were a sandbox affiliate ID pointed at the production API, not a Figure outage — see §6.1
- TMF now collects the whole application itself, encrypted at rest, and the
  application form **accepts nothing until John installs the encryption key**

If a new session cannot tell you those things, it has not read the file. Ask it
to read `TMF-WEBSITE-HANDOFF.md` again before letting it edit anything.

---

## What is in this package

| File | Read it when |
|------|--------------|
| `TMF-WEBSITE-HANDOFF.md` | **First. Always.** The full picture |
| `README.md` | Quick orientation to the file layout and design system |
| `SETUP-APPLICATION.md` | **Read first if applications matter.** Setup, keys, reading them |
| `SETUP-FIGURE-API.md` | Working on the HELOC offers panel |
| `SETUP-LEAD-CAPTURE.md` | Changing where form submissions go |
| `google-apps-script.gs` | The script behind the leads spreadsheet |

---

## The six things waiting on you, not on Claude

These are blocked on information or actions only you can provide. A new session
will ask about them, and it should.

1. **Install the application encryption key.** `SETUP-APPLICATION.md`, steps 1
   to 3, about ten minutes in cPanel. Until you do, the application form
   refuses every submission — deliberately, so that nobody's Social Security
   number is ever stored unencrypted.
2. **Push the 22 commits** via GitHub Desktop, then deploy from cPanel.
3. **A phone number and an email address for the site.** There is currently no
   way for a visitor to reach a human. This has been raised in four sessions and
   never answered.
4. ~~Your real industry multipliers.~~ **Supplied 18 Aug 2026** — restaurant
   1.2, retail 1.1, construction 0.8, trucking 0.75, healthcare 1.2, everything
   else 1.0. Done.
5. **Ask Figure** whether your account is provisioned for the `OFFERS` request
   type. Every production call returns HTTP 500.
6. **Settle the Figure question.** The application side is resolved — TMF now
   collects its own, and Signet is off the site. But the Figure affiliate
   account still belongs to Signet Capital Group, so HELOC leads still land in
   their account. Decide whether you want your own.

7. **Decide how long you keep applications.** Nothing deletes them
   automatically, and you are now holding Social Security numbers.
