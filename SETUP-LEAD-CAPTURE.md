# Sending leads to a Google Sheet

Right now the calculator and contact form collect information and throw it
away. These steps connect them to a spreadsheet. It takes about ten minutes
and costs nothing.

You do steps 1–5. Then send me the URL from step 4 and I'll do step 6.

---

## 1. Make the spreadsheet

1. Go to **sheets.google.com** and click **Blank spreadsheet**.
2. Name it something like **TMF Team — Leads** (top-left corner).

Leave it empty. The script creates the tabs and column headings itself.

---

## 2. Open the script editor

In that spreadsheet: **Extensions** → **Apps Script**.

A new tab opens with a code editor containing a few lines of sample code.

---

## 3. Paste in the code

1. Select everything in the editor and delete it.
2. Open the file **google-apps-script.gs** (in your site folder), copy all of
   it, and paste it in.
3. *Optional:* near the top, put your email address between the quotes on the
   `NOTIFY_EMAIL` line to get an email for every new lead.
4. Click the **save** icon.

---

## 4. Publish it

1. Click **Deploy** (top right) → **New deployment**.
2. Click the **gear icon** next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** **Anyone**
4. Click **Deploy**.
5. Google asks you to authorise it. Click through: **Authorize access** →
   pick your account → **Advanced** → **Go to (your project name)** →
   **Allow**.

   > The "unverified app" warning is expected. It's your own script, running
   > in your own account, writing to your own spreadsheet.

6. Copy the **Web app URL**. It looks like:
   `https://script.google.com/macros/s/AKfy...long.../exec`

**Send me that URL.**

---

## 5. Check it works

Paste the URL into your browser address bar and press Enter. You should see:

```
{"ok":true,"message":"TMF Team lead endpoint is live."}
```

If you see an error instead, something in step 4 didn't take — tell me what it
says.

---

## 6. I connect the site

I paste the URL into `assets/app.js` and send you an updated zip. You upload it
the usual way, then submit a test lead and watch the row appear in your sheet.

---

## What gets recorded

**Calculator leads** — monthly revenue, credit band, existing MCA positions,
time in business, industry, business name, first and last name, email, phone,
plus the estimate they were shown and which products matched.

**Contact messages** — first and last name, business name, email, phone, and
their message.

Both also record the time, which page it came from, and the referrer, so you
can see which traffic actually converts.

---

## If you ever change the script

Apps Script keeps serving the old version until you redeploy. After editing:
**Deploy** → **Manage deployments** → pencil icon → **Version: New version** →
**Deploy**. The URL stays the same.
