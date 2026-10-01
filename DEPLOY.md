# How the new tmfus.com goes live

Short version: the boss merges on GitHub, you click two buttons in cPanel,
then the boss runs a check. Nothing here can break `api/config.php` on the
server: the deploy never touches it.

## Part 1. GitHub (you do nothing)

1. The boss merges the `redesign-2026` branch into `master` on GitHub.
2. That is all. You do not need to open GitHub for this.

## Part 2. cPanel (you)

1. Log in to cPanel for tmfus.com.
2. Click **Git Version Control**.
3. Next to the tmfus repository, click **Manage**.
4. Click the **Pull or Deploy** tab.
5. Click **Update from Remote**. Wait until it says it finished.
6. Click **Deploy HEAD Commit**.
7. Wait. The first deploy is slow (5 to 15 minutes, maybe more) because the
   site now carries about 145 MB of film pictures and clips. Later deploys
   are quicker. Do not click the button twice and do not close the page.
8. When it says the deployment is done, open https://tmfus.com and
   press Ctrl+F5 once so your browser forgets the old site.

If the button says "cannot deploy" or shows a red error, stop and send the
boss a screenshot. Do not try again and again.

## Part 3. Check it is really live

1. Tell the boss "deployed". The boss runs `scripts/live-check.sh`.
2. If you want to run it yourself, open Git Bash in the repo folder and type
   `./scripts/live-check.sh`, then press Enter.
3. You want to see **green ticks and no red crosses**. Red means the site on
   the server is not the same as the repo. Send the boss the screen.
4. Run `./scripts/compare-live.sh` to prove the new site kept every page, title,
   and form from before the deploy (exit 0 means all URLs are still 200).

## After launch

Do this right after cPanel says the deploy is done. It only looks at the
site. It never fills in a form and never changes anything.

1. Open **Git Bash** in the repo folder.
2. Type `./scripts/post-launch.sh` and press Enter.
3. Wait about 3 minutes. It checks one thing per second on purpose, so the
   server is not bothered.
4. Read the very bottom of the screen:
   - **Green** "Everything important works." means you are done. Yellow
     lines under "Worth knowing" are notes, not problems.
   - **Red** crosses mean something is broken. It lists each problem in
     plain words.
5. If you see red: select everything in the Git Bash window, copy it, and
   paste it to Claude with the words "post-launch is red". Do not deploy
   again until Claude has looked.

One line always says "HSTS: present" or "absent". That is information for
you to decide on later, not an error.

## Good to know

- The old `master` (version 43) stays in GitHub history, so going back is
  possible. Ask the boss.
- `api/config.php` (all the passwords) lives only on the server. The deploy
  copies the other api files one by one and never deletes it.
