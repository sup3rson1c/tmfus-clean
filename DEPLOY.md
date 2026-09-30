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

## Good to know

- The old `master` (version 43) stays in GitHub history, so going back is
  possible. Ask the boss.
- `api/config.php` (all the passwords) lives only on the server. The deploy
  copies the other api files one by one and never deletes it.

## Extra locks for the admin page (optional, all OFF today)

The admin page (`https://tmfus.com/admin.php`) shows customer applications.
It already needs a password. You can add up to three more safety steps.
Each one stays off until you change one line in `api/config.php` on the
server. Nothing here happens by itself when the site deploys.

You do these in cPanel. You never put these secrets in GitHub, email or chat.

### Before you start: open the Terminal in the right folder

1. Log in to cPanel. Click **Git Version Control**.
2. Look at the **Repository Path** column next to the tmfus repository
   (it looks like `repositories/tmfus`). Write it down.
3. Go back to the cPanel home page and click **Terminal**.
4. Type `cd ` then the path from step 2 (for example
   `cd repositories/tmfus`), and press Enter.

### Lock A: keep the password as a scrambled "hash"

Today the password sits in `api/config.php` as plain words. A hash is a
scrambled copy: the page can still check your password, but nobody reading
the file can learn it.

1. In the Terminal (see above), type `php tools/hash-password.php` and
   press Enter.
2. Type your admin password and press Enter. You will not see it as you
   type. That is normal. Type it again when it asks.
   Use the SAME password you use now, or your browser's saved key has to be
   set up again.
3. It prints a line starting with `'admin_password_hash' =>`. Copy that
   whole line.
4. In cPanel click **File Manager**, open `public_html/api/`, right-click
   `config.php`, click **Edit**.
5. Find the line `'admin_password_hash' => '',` and replace it with the
   line you copied.
6. Find `'admin_password' => '...'` and change it to `'admin_password' => '',`
7. Click **Save Changes**. Open the admin page and sign in to check.

### Lock B: a 6-digit code from your phone (two-step sign-in)

After the password, the page asks for a code from an app on your phone. A
stolen password alone is then not enough.

1. Put an authenticator app on your phone (Google Authenticator or
   Microsoft Authenticator are fine).
2. In the Terminal (see above), type `php tools/totp-setup.php` and press
   Enter.
3. In the phone app, tap **Add** (or **+**), then **Enter a setup key**.
   Type the account name and the key it printed. Choose **Time based**.
4. The app now shows a 6-digit number. It should match the one the
   Terminal printed (or the next one, if 30 seconds passed).
5. In File Manager, edit `public_html/api/config.php` again. Find
   `'admin_totp_secret' => '',` and put the key between the quotes, like
   the Terminal showed you.
6. Click **Save Changes**. Sign out of the admin page and sign in again:
   password first, then the code from the phone.
7. To switch it off (for example, you lost the phone), edit the same line
   back to `'admin_totp_secret' => '',`

### Lock C: only let your own internet address in

Anyone else who opens the admin page just sees "Forbidden".

1. On the computer you use for the admin page, search Google for
   "what is my ip". Write down the number it shows.
2. In File Manager, edit `public_html/api/config.php`. Find
   `'admin_allowed_ips' => [],` and put your number inside, with quotes,
   like this: `'admin_allowed_ips' => ['203.0.113.7'],`
   More than one place? Separate them with commas:
   `['203.0.113.7', '198.51.100.20'],`
3. Click **Save Changes**. Open the admin page to check you still get in.
4. Warning: home and phone internet addresses can change. If one day you
   see "Forbidden", your address changed. Do step 1 again and put the new
   number in (File Manager still works, because it is inside cPanel).
5. To switch it off, edit the line back to `'admin_allowed_ips' => [],`

Leave `'trusted_proxy'` empty unless the boss tells you otherwise.
