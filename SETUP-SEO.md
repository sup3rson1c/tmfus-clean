# Search and AI visibility

What was built into the site on 18 Aug 2026, what it will and will not do, and
the things only John can do.

---

## Start with the honest part

**Nobody can put tmfus.com at the top of "business funding" searches.** That
term, and its neighbours — merchant cash advance, small business loans, working
capital — sit in one of the most contested and most heavily spammed corners of
search. The sites holding those positions have thousands of pages, years of
history, and marketing budgets in the hundreds of thousands. Technical work on a
nine-page site does not move them.

What is realistically winnable:

- **Long-tail questions.** "can I get an SBA loan with MCA positions", "how many
  months of bank statements for a merchant cash advance", "SBA 7a vs 504 for
  buying a building". Lower volume, far higher intent, and the site already
  answers some of them better than the pages currently ranking.
- **Local searches**, once there is a phone number and an address — see below.
- **AI citations.** This is genuinely open. Assistants pick sources on
  structure and clarity more than on domain authority, which is the one place a
  small site is not automatically outgunned.

Treat SEO as a nine-month project. Anyone promising page one in weeks is
charging for something they cannot deliver.

---

## What is now in the site

All of this was missing entirely before.

| Added | Why it matters |
|-------|----------------|
| `robots.txt` | There was none. It points to the sitemap and **explicitly allows AI crawlers** — GPTBot, PerplexityBot, ClaudeBot, OAI-SearchBot, Google-Extended and others. Blocking them is the fastest way to be invisible in AI answers. `admin.php` and `/api/` are disallowed. |
| `sitemap.xml` | There was none. Ten indexable URLs, in clean form, **generated** by `seo-inject.py` from one list rather than kept by hand. |
| Canonical URLs | There were none. Every page now declares its one true address. |
| Open Graph + Twitter cards | Links to the site in messages, Slack and social now show a title, description and logo instead of a bare URL. |
| JSON-LD structured data | Organization + FinancialService + WebSite on the home page, WebPage on all, Service on the four product pages, **FAQPage wherever there is an accordion** — now 26 question/answer pairs across five pages. |
| Internal links fixed | Every internal link pointed at `foo.html`, which `.htaccess` then 301-redirected to `/foo`. Every click and every crawl was paying a redirect hop. They now point straight at the clean URL. |
| `llms.txt` | Present, with a caveat — see below. Now carries a "facts an assistant can rely on" block and an explicit instruction not to attribute a phone number from elsewhere. |

Added 20 Aug 2026:

| Added | Why it matters |
|-------|----------------|
| `robots` meta with **`max-snippet:-1`** | The default caps how much of a page Google will show, and answer engines inherit that limit. Without it, the good long answers on the FAQ pages get truncated at roughly 160 characters before anyone can quote them. This is the single highest-leverage tag added. |
| `max-image-preview:large` | Large thumbnails in results and in AI answers rather than a favicon-sized one. |
| `BreadcrumbList` on every page but the home page | Google draws these under the result instead of a raw URL, and an assistant uses them to work out where a page sits rather than guessing from the path. |
| `LoanOrCredit` on the three product pages | Declares each product with a real `MonetaryAmount` range — $5K–$2M, $50K–$5M, $25K–$750K. This is the shape an engine reasons about when somebody asks "how much can I get". **No rate, factor or term is declared anywhere**, because none is knowable before underwriting and a wrong number in schema becomes a wrong number in somebody's AI answer. |
| `HowTo` on the application | Four steps and four required supplies, matching the real form exactly. This is what gets quoted when somebody asks an assistant what they need to apply for business funding. |
| `AboutPage` / `ContactPage` types | More specific than plain `WebPage`, which is what those two pages are. |
| `datePublished` / `dateModified` | Freshness signal. A constant in `seo-inject.py`, not `date.today()` — claiming every page changed today, every time the script runs, is a signal engines learn to ignore. |
| `hreflang` en-us and x-default | Cheap, and removes an ambiguity for a US-only site. |
| FAQ sections on the home page and the estimator | Six and five questions. These two pages had no accordion, so they contributed nothing to the FAQ schema and nothing quotable. Now they do. |
| `/terms` and `/privacy` | Indexed, low priority. Real legal pages are a trust signal on a finance site, and their absence is one of the things a reviewer notices. |
| Broker disclosure in the footer of every page | "TMF Team is a business funding brokerage, not a lender." Compliance first, but it also stops an assistant describing TMF as a lender, which is the single most likely thing for one to get wrong. |

The FAQ schema is generated from the accordions on the page, so the structured
data and the visible text can never drift apart. Re-run `seo-inject.py` from
inside the site folder after changing any FAQ and it regenerates.

---

## Why FAQ schema specifically

Of everything above, this is the piece most likely to earn AI citations.
Reporting on how ChatGPT, Perplexity and Google's AI Overviews select sources
consistently finds FAQ-marked content is weighted more heavily, and that
structured data materially improves selection for AI Overviews. The mechanism is
plausible: an assistant answering "how long does an SBA loan take" wants a
self-contained answer it can lift, and that is exactly the shape FAQ schema
declares.

The strongest single predictor reported is **semantic completeness** — a
complete answer that stands on its own without needing the rest of the page.
The SBA and MCA answers already read that way. Keep writing them like that.

---

## About llms.txt

It is there. Do not expect much from it.

The 2026 data is not kind: an Ahrefs study across 137,000 domains found **97% of
llms.txt files received zero requests from anything**, and of the requests that
did arrive, SEO audit tools outnumbered AI bots several times over. Google has
stated plainly that llms.txt has no effect on Search visibility, and neither
OpenAI nor Anthropic endorses it for visibility — both point site owners at
robots.txt instead.

It costs nothing, it is well-formed, and if adoption changes it is already
there. But if anyone tells you llms.txt is how you get into AI answers, they are
selling something. **robots.txt is the file that actually decides whether AI
crawlers can read the site**, and that one is now correct.

---

## The things only John can do

These matter more than everything above combined.

### 1. A phone number and a physical address

**This has now been raised in six sessions across two different assistants and
never answered.** It is the single biggest thing standing between tmfus.com and
search visibility, for reasons that go past inconvenience:

- No phone means **no Google Business Profile**, which means no map pack, no
  local results, and no presence in the searches most likely to convert.
- Google's quality guidelines treat contactability as a trust signal for
  anything touching money. A finance site with no way to reach a human reads as
  low-trust to a rating system and to a human visitor alike.
- The Organization schema now on the site has a deliberate hole where
  `telephone` and `address` should be. **Nothing fake was put there** — wrong
  NAP data is worse than absent NAP data, because it propagates.

Supply those two things and they can be added in ten minutes, along with
LocalBusiness schema and a Google Business Profile.

### 2. Google Search Console and Bing Webmaster Tools

Free, and both are how you find out what is actually happening rather than
guessing. Verify the domain, submit `https://tmfus.com/sitemap.xml`, and read
the Performance report monthly. Bing matters more than its market share
suggests, because **ChatGPT's web retrieval runs on Bing's index**.

### 3. More pages that answer real questions

Nine pages will not carry a content strategy. The pages that will earn links and
citations are the ones answering the questions merchants actually type — the
kind already sitting in your chat transcripts and phone calls. One good page per
question beats a rewrite of the home page.

The chat logs are now a keyword research tool. Read what people actually ask.

### 4. Be somewhere other than your own website

Assistants and search engines both weigh whether anyone else references you.
Industry directories, a LinkedIn company page, trade association listings,
genuine local citations. This is slow and unglamorous and it is most of what
separates sites that rank from sites that do not.

---

## Re-running the generator

From inside the site folder:

```bash
python3 seo-inject.py
```

Idempotent — it strips its previous output before writing new output, so running
it repeatedly is safe. Run it after changing any page title, meta description or
FAQ. It **does** rewrite `sitemap.xml` now, from the `SITEMAP` dictionary at the
top of the script.

**Adding a page takes three edits, and missing any one of them fails silently:**

1. `PAGES` and `SITEMAP` in `seo-inject.py` — otherwise no canonical, no schema,
   not in the sitemap.
2. The `clean_links` regex in the same file — otherwise links to it keep paying
   a 301.
3. `.cpanel.yml` — otherwise the page never reaches the server at all.

`verify.sh` catches the third one. Nothing catches the first two but you.

`seo-inject.py` is not deployed to the server — it is a build tool, and
`.htaccess` blocks `.py` files from being served anyway.

---

## Sources

Current as of 18 Aug 2026:

- [How ChatGPT, Google AI Overviews, and Perplexity Source Information in 2026](https://www.leapd.ai/blog/ai-visibility/how-chatgpt-google-ai-overviews-and-perplexity-source-information-in-2026)
- [llms.txt adoption rises 8.8x but 97% of files get zero AI requests](https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/)
