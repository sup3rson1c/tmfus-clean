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
