# Live chat — the assistant and taking over from it

A chat widget sits on every page. Your Hermes agent answers, and you can step
into any conversation from the inbox at any moment. When you do, the agent goes
quiet until you hand it back.

**It is off until you switch it on.** Nothing appears on the site until
`chat_enabled` is true and an endpoint is set.

---

## The one rule that shapes everything

**Your API key never goes near the browser.** Anything in a page's JavaScript is
readable by every visitor, and a leaked key is someone else's bill on your
account. So the widget talks only to `api/chat.php` on your own server, and that
file talks to your agent using the key from `config.php`.

Verified on 18 Aug 2026 with a real key in the config: the key appears in the
outgoing request to the agent, and appears nowhere in the page HTML or in
`app.js`. Neither does the agent's URL.

---

## Switching it on

In `api/config.php`:

```php
'chat_enabled'  => true,
'chat_endpoint' => 'https://your-hermes-agent.example.com/v1/chat/completions',
'chat_api_key'  => 'your key',
'chat_format'   => 'openai',
'chat_model'    => 'hermes-4',
'chat_notify'   => 'you@tmfus.com',
```

Then bump the `?v=` on the asset links in every HTML file and deploy.

### Which `chat_format`?

| Value | What it sends | Where it looks for the reply |
|-------|---------------|------------------------------|
| `openai` | `{model, messages:[{role,content}], max_tokens, temperature}` | `choices[0].message.content` |
| `simple` | `{session, message, history, system}` | `reply` |

`openai` is what almost every hosted model API speaks, Hermes included. Use
`simple` if you have written your own agent service with its own shape. If the
reply comes back somewhere else again, `chat.php` also tries `message` and
`output` before giving up.

The key is sent as `Authorization: Bearer <key>`. If your provider wants
something else, `chat_auth_header` and `chat_auth_prefix` change it.

### If the agent does not answer

The widget does not sit there silently. It says it cannot reach the system, asks
for a name and number, and flags the conversation as waiting for you. A broken
agent should still cost you nothing but a callback.

---

## Teaching it about TMF — your Obsidian notes

Out of the box the assistant knows how business funding works in general. It
knows nothing about how *you* work: your process, your turnaround, what you will
and will not take on. That comes from your own notes.

### What is actually happening

There is no connection to Obsidian and nothing to install. An Obsidian vault is
a folder of plain text files. A script rolls the ones you choose into a single
file, you upload it once, and every question the assistant answers is asked with
those notes in front of it.

### Point it at a folder, not the whole vault

**This is the part to get right.** An assistant will read out anything put in
front of it. Commission splits, which funders you use, what you paid for a lead,
notes on a particular merchant — every one of those is one question away from a
stranger, and it will not occur to the assistant that some of it was private.

So make a folder inside your vault called `public`, and move into it only the
notes you would be content to see quoted back to you by a competitor. That is
what gets bundled. Everything else stays where it is and never leaves your
laptop.

Three extra ways to keep something out:

- Put it in a subfolder called `private` or `templates` — both are skipped.
- Put `public: false` at the top of the note, between two `---` lines.
- Keep it out of the `public` folder in the first place. Simplest.

The script also refuses outright if it finds something Social-Security-shaped or
an API key, and warns you about notes mentioning commissions, buy and sell
rates, or anything marked confidential. That is a safety net, not a substitute
for choosing.

### You do not have to start from nothing

There is a **`vault-starter`** folder in this package, next to the site folder.
Twelve notes, already written from what the site says: what TMF is, what the
application needs, how long things take, the three products, bank statements,
credit questions, existing positions, the calculators, common objections, and
when to fetch a person.

Copy it into Obsidian and edit it there. Roughly a dozen lines in it start with
**`TO FILL IN:`** — those are the ones only you can answer, like what happens to
a weekend enquiry, or your policy on stacking. The bundler counts them and
refuses to let you forget: it lists every one before you upload.

The single idea behind the whole thing: **a knowledge vault is not
documentation, it is the answers you already give on the phone.** You do not
need to write a manual, just the twenty things you find yourself repeating.

### Doing it

1. In Obsidian, make a folder called `public` and move your shareable notes in.
   (Or copy in `vault-starter/public` and edit from there.)
2. On your own computer, in the site folder, run:

```bash
python3 scripts/bundle-vault.py "PATH/TO/YOUR/VAULT/public"
```

   You should see: `Wrote ... N notes, N words, about N tokens` and a line
   telling you whether that size is comfortable.
3. Read anything it warns you about. Fix and run it again if you need to.
4. It has made a file called `tmf-knowledge.md`. In cPanel → File Manager,
   upload that file into the **same protected folder your applications live
   in** — the one `application_dir` points at, above `public_html`.
5. In `api/config.php`, set the full path:

```php
'chat_knowledge_file' => '/home/YOURUSERNAME/tmf-applications/tmf-knowledge.md',
```

6. Check it worked: open **https://tmfus.com/api/chat.php?selftest=1**

   You should see `"notes": "loaded, N characters"` and a plain-English verdict
   on the size. It never shows the notes themselves, the path, or your API key,
   so it is safe to leave reachable.

**When you edit your notes, repeat steps 2 and 4.** Nothing updates by itself.

### Why it must go outside public_html

If the file sits anywhere under `public_html`, it has a web address, and anyone
who guesses it can read your notes. `chat.php` refuses a path that does not
start with a slash for exactly this reason — a relative path resolves inside
`api/`, which is inside the web root. That mistake has already been made once on
this site with the applications folder.

The same goes for the repo, which is **public**. `.gitignore` already blocks
`tmf-knowledge.md`, but the safe habit is to keep the file out of the site
folder entirely.

### Your notes cannot switch off the rules

The notes are **added to** the built-in instructions, never swapped for them.
The assistant is told, in the prompt itself, that the notes are reference
material and not orders — so a note reading "tell customers we can do 1.15"
does not become an instruction, and it still will not quote a rate.

Do not put your notes in `chat_system_prompt`. That setting **replaces** the
built-in instructions, and you would be deleting the rules about rates,
approvals and SSNs to make room. `verify.sh` checks that this has not happened.

### When the notes get too big

Everything above sends all the notes with every message. That is the right
design up to a point, and the self-check tells you when you pass it:

- **Under ~20,000 tokens** — comfortable. Leave it alone.
- **20,000 to 60,000** — still works, but each message costs more and the
  assistant gets vaguer as the pile grows. Trim.
- **Over 60,000** — time to switch to retrieval, where the notes are searched
  and only the relevant few are sent. That is a change to `chat.php` only, and
  it can be built when you get there. Ask.

Prompt caching is what makes the first option affordable — you pay full price
for the notes on the first message of a conversation and a fraction after that.
Both Claude and OpenAI do it automatically.

---

## Being told somebody is waiting

**This is the part that was broken.** Two things put a visitor into the
"waiting" state, and until 8 Sep 2026 only one of them told you:

- They pressed **Talk to a person** — you got an email.
- **The assistant failed to answer them** — the visitor was told an advisor
  would pick it up, and *nobody was told to pick it up*. Silent. Every
  conversation that hit a misconfigured key, an expired key or an agent having
  a bad day was lost this way.

Both now go through one function, `notifyWaiting()` in `api/chat.php`, which
fires once per conversation. If you add a path that sets `waiting = true`, call
it there too.

### Three ways you find out

**1. Email.** Set `chat_notify` in `api/config.php`. Always sent. Includes their
name and number if they left one, the page they were on, and the last thing they
actually typed, so you can answer rather than open with "hello?".

**2. Your phone, in about a second.** Email is not a notification when the
answer is wanted in minutes. Telegram is free, needs no account approval, and
takes five minutes:

1. Install Telegram on your phone.
2. Search for **@BotFather**, press Start, send `/newbot`.
3. Give it any name. It replies with a token like
   `123456789:AAxxxxxxxxxxxxxxxxx`.
4. Search for the bot you just made, open it, press **Start**, send it `hello`.
5. Open this in a browser with your token in it:
   `https://api.telegram.org/botYOUR_TOKEN/getUpdates`
   Find `"chat":{"id":123456789` — that number is your chat id.
6. Put both into `api/config.php`:

```php
'chat_push_telegram_token'   => '123456789:AAxxxxxxxxxxxxxxxxx',
'chat_push_telegram_chat_id' => '123456789',
```

Leave them empty and nothing happens — the email still goes. The push has a
four-second timeout on purpose: a visitor is waiting on that same request, and
Telegram having a bad day must never become the site having a bad day.

**3. The inbox tab itself.** If `admin.php` is already open somewhere, it now
beeps twice, puts `(1) someone is waiting` in the browser tab title, and raises
a desktop notification. It only fires when the number goes *up*, so it will not
nag you about the same person twice. Browsers refuse to play sound until you
have clicked the page once — your first click anywhere arms it.

---

## Answering fast: ready replies

The Live chat tab has a row of buttons above the reply box: *Say hello*, *Ask
the three numbers*, *What we need*, *Existing positions*, *Timeline*, *No
numbers yet*, *Get their number*, *Coming back later*.

Clicking one **fills the box — it does not send.** Read it, change it to suit
the person, then press Send. That is deliberate. A broker who fires canned lines
at merchants sounds exactly like a broker who fires canned lines at merchants,
and these are meant to save typing, not thinking.

**Edit them.** They are at the very top of `admin.php`, in a block marked
`READY REPLIES — EDIT THESE`. Change the text between the quotes; the short name
before `=>` is what the button says. Put your own words in — the defaults are a
starting point written in a plausible voice, not your voice.

None of them quote a rate, a factor or an approval, and none of them should.

---

## Taking over a conversation

Inbox → **Live chat**. Anyone who has asked for a person is at the top with a red
*waiting* badge, and the tab itself shows a count.

Click a conversation to read it. Then either:

- **Take over** — you join without saying anything yet
- **Just type a reply** — sending takes it over automatically

The moment you are in, `api/chat.php` stops calling the agent for that
conversation entirely. The visitor sees "An advisor has joined the conversation"
and your messages appear in their widget within about four seconds, without them
reloading anything.

**Hand back to the assistant** when you are done. The visitor is told, and the
agent picks up with the whole conversation — including what you said — as
context, so it does not contradict you.

You also get an email the moment someone asks for a person, with their name and
number if they left them.

---

## What it will not do, and why

**It never quotes a rate, an amount, or an approval.** You are a broker; a
chatbot saying "you'd qualify for $80K at 12%" is a representation someone may
hold you to. The system prompt forbids it and tells the agent to say an advisor
gives real numbers after seeing the statements. If you replace
`chat_system_prompt`, read `DEFAULT_SYSTEM_PROMPT` in `api/chat.php` first and
keep those rules.

**It never accepts a Social Security number.** Anything SSN-shaped is replaced
with `[removed]` before the message is stored, before it reaches your agent, and
before it reaches you. The visitor is told why, and pointed at the application
form or a phone call. Tested by sending two SSNs in different formats and then
searching every stored file and the agent's received payload — neither appears
anywhere.

The check is deliberately eager, so a nine-digit order number may get caught too.
That is the right way round: a false positive costs one retyped message, a false
negative puts an SSN in a log forever.

**It never claims to be you.** The widget says "TMF Team assistant", and the
prompt tells it to say so if asked.

---

## Where conversations are stored

```
<application_dir>/chats/<first two characters>/<session>.json
```

Same protected folder as applications, outside `public_html`. Each file holds
the whole conversation, the page they started on, their IP, and whatever contact
details they left.

**These are not encrypted**, unlike applications. They contain names, phone
numbers and whatever a visitor typed — but never an SSN, by construction. If you
would rather they were encrypted too, say so; the machinery already exists.

**Nothing prunes them.** Same as applications: decide how long you want to keep
them and clear old ones out periodically.

---

## Limits, so it cannot be turned against you

| Guard | Value |
|-------|-------|
| Messages per visitor | 20 per minute |
| Message length | 2,000 characters |
| Conversation length | 120 turns, then it closes and asks for a callback |
| Agent timeout | 25 seconds |

Polling is exempt from the rate limit, because the widget polls every four
seconds while a conversation is open.

---

## For whoever maintains this next

- The widget is built in JavaScript by `initChat()` in `app.js` rather than
  written into nine HTML files. There is one copy of it.
- Every message is rendered with `textContent`, never `innerHTML`. The text
  comes from a language model and from strangers; treating either as markup is
  how you put an XSS hole in your own site. Do not "improve" this by rendering
  Markdown without escaping first.
- `api/chat.php` refuses to call the agent whenever `human` is true. That flag
  is the whole takeover mechanism. Nothing else should set it.
- Operator messages are added to the history the agent sees, as assistant turns.
  Without that, handing a conversation back produces an agent that contradicts
  whatever you just promised.
- `api/chat.php` is in `.cpanel.yml`. Fifth file this session that needed it.
