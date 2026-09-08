# Unsubscribe — setup

The opt-out page and the endpoint behind it. Read this before deploying, because
one setting has to be right or opt-outs silently fail.

**What this is for.** Two different jobs, and it helps to keep them apart.

- The sending platform (Smartlead) already puts an unsubscribe link in campaign
  emails and handles the one-click headers. Nothing here replaces that.
- This is the address people are pointed at when they reply "stop", when they
  find you some other way, or when you send from anywhere the platform is not
  driving. It is also the one place every opt-out is written down, which is the
  record you would want if anyone ever asked.

---

## What got added

| File | What it does |
|---|---|
| `unsubscribe.html` | The public page, at `https://tmfus.com/unsubscribe` |
| `api/unsubscribe.php` | Records the opt-out and emails you about it |
| `api/config.example.php` | Four new settings, listed below |
| `.cpanel.yml` | Both new files, so they actually deploy |
| `seo-inject.py` | The page is marked never-indexed, like the 404 page |
| `scripts/verify.sh` | Five new checks |

---

## Step by step

**1 · Pick a folder for the list, outside the website.**

In cPanel, open **File Manager**. Go up one level from `public_html`, into your
home folder. Make a new folder called `tmf-suppression`.

It must be *outside* `public_html`. Anything inside `public_html` can be
downloaded by anyone who guesses the name, and this file is a list of real
people's email addresses.

Write down the full path. It looks like `/home/YOURACCOUNT/tmf-suppression`.

**2 · Make a random secret.**

In cPanel open **Terminal** and paste this:

```bash
php -r "echo bin2hex(random_bytes(32)), \"\n\";"
```

Copy the long line it prints.

**3 · Put both into the config.**

In File Manager, open `public_html/api/config.php` and edit it. Find the
unsubscribe block and fill in four things:

```php
'unsubscribe_dir'    => '/home/YOURACCOUNT/tmf-suppression',
'unsubscribe_secret' => 'the long line from step 2',
'unsubscribe_notify' => 'your@email.com',
'unsubscribe_from'   => 'no-reply@tmfus.com',
```

`config.php` lives only on the server and is never in the repo. If it does not
have that block yet, copy it across from `config.example.php`.

**4 · Deploy.**

Commit and push, then in cPanel click **Deploy HEAD Commit** as usual.

**5 · Test it properly, once.**

Go to `https://tmfus.com/unsubscribe`, type an address you own, press the
button. Three things should happen:

- the page says you are off the list
- a line appears in `tmf-suppression/suppression.jsonl`
- an email lands in your inbox

If nothing is written, the path in step 1 is wrong. The endpoint refuses to
write rather than dump the list somewhere public, so a wrong path means opt-outs
fail loudly in the error log instead of quietly succeeding in the wrong place.

---

## The part that is easy to forget

**Recording an opt-out here does not stop the mail.** Smartlead is what sends,
so the address has to reach Smartlead's **Global Block List** as well. That is
why the endpoint emails you on every single opt-out rather than batching: the
email is the reminder to go and paste it in.

Do it across the whole account, not one campaign. All the sending domains are
one sender as far as the recipient and the regulator are concerned, so an
opt-out from one is an opt-out from all of them.

**The clock:** mailbox providers expect it done within 48 hours. The law allows
10 business days. Work to 48 hours.

A paste-ready list of every address, one per line, is at
`tmf-suppression/suppression.txt`.

---

## If you ever send mail yourself instead of through a platform

The endpoint already supports the one-click standard that Gmail and Yahoo
require. Put these two headers on the message:

```
List-Unsubscribe: <https://tmfus.com/api/unsubscribe.php?t=TOKEN>, <mailto:...>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

Both headers must be inside the DKIM signature or providers ignore them.

Build a `TOKEN` for an address with:

```bash
php -r '$c=require "api/config.php"; $e="them@example.com";
 $p=rtrim(strtr(base64_encode($e),"+/","-_"),"=");
 $s=rtrim(strtr(base64_encode(hash_hmac("sha256",$e,$c["unsubscribe_secret"],true)),"+/","-_"),"=");
 echo "$p.$s\n";'
```

The token is signed so a URL cannot be edited into somebody else's address, and
so the raw address never travels in a link that ends up in server logs.

---

## Two things the code refuses to do, on purpose

**A GET never unsubscribes anyone.** Mail scanners and clients prefetch links.
If following a link removed people, one security gateway crawling a campaign
would empty the list overnight and nothing would look wrong. The standard says
GET may show a page and only POST may act, which is why the page has a button.

**The response never says whether the address was on a list.** Otherwise anyone
could sit and test addresses against it to find out who you mail. Every
well-formed request gets the same answer.
