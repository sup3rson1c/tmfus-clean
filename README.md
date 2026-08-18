# TMF Team — static rebuild

A dependency-free rebuild of tmfline.online. No build step, no framework — open
`index.html` in a browser or drop the folder on any static host (Netlify, Vercel,
Cloudflare Pages, S3, nginx).

```
index.html              Home — hero, funding calculator, products, why-us, stages, CTA
funding-estimator.html  3-step cash-injection calculator + live product matching
heloc-calculator.html   Live HELOC estimator + FAQ accordion
sba-loans.html          SBA 7(a) and 504 — standards, eligibility, FAQ. No calculator
mca.html                Process timeline, remittance mechanics, ideal-for, FAQ
apply.html              Branded 4-step application, all 29 fields, encrypted
about.html              Mission, approach, stats
contact.html            Contact form
404.html                Not found
assets/logo-mark.svg    Ascent logo mark (48px, gradient)
assets/logo-lockup.svg  Horizontal lockup — mark + "TMF Team / Capital Strategy"
assets/favicon.svg      Simplified mark for tabs
assets/styles.css       Whole design system — tokens at the top of the file
assets/app.js           Every interaction, both calculators, all integrations
api/figure-heloc.php    Server-side proxy to Figure's HELOC API
api/application.php     Application intake — bank statements, notification
api/config.example.php  Template. The real config.php lives ONLY on the server
```

**New here?** Read `TMF-WEBSITE-HANDOFF.md` first — it assumes no prior context
and covers deployment, open items and the traps that have already cost time.

## Design tokens

All colours, radii and fonts live in `:root` at the top of `assets/styles.css`.
Change `--accent` / `--accent-2` / `--accent-grad` to reskin the whole site.

## Animations & microinteractions

| Where | What |
|---|---|
| Header | Transparent → blurred on scroll; gradient scroll-progress bar |
| Hero | Seven floating glass shards (CSS keyframes) |
| Backdrops | Scroll parallax on every `[data-parallax]` layer — one shared rAF loop, IntersectionObserver-gated. Off for `prefers-reduced-motion` and under 680px |
| Status pill | Pulsing glow dot |
| Everything | `data-reveal` fade-up on scroll via IntersectionObserver, auto-staggered |
| Stats | Count-up animation when scrolled into view |
| Product cards | Hover lift + cursor-following radial glow + arrow slide |
| Why-us list | Row activates as it enters the viewport |
| Stages | Left rail fills, card shifts, scanning light sweep on the active stage |
| Buttons | Gradient cross-fade, lift, arrow slide |
| Selects | Custom dropdowns with pop-in animation |
| Accordion | Height-animated, one open at a time |
| Sliders | Gradient-filled track that tracks the thumb |
| Calculator | Animated step progress bar, step slide-in transitions |
| Mobile | Animated hamburger + slide-down nav |

`prefers-reduced-motion` is respected throughout.

## Calculators

### Funding estimator (`funding-estimator.html`, and the hero on `index.html`)
Three steps: revenue + credit + MCA positions → business details → contact.
The right-hand panel matches products **live** as you type.

Matching rules and the indicative advance range live in `assets/app.js` under
`PRODUCTS` and `estimateAdvance()` — thresholds are in one place so you can tune
them without touching markup.

### HELOC calculator (`heloc-calculator.html`)
Takes the lower of two ceilings:

- **Equity ceiling** = home value × lender max LTV − mortgage balance
- **Income ceiling** = (43% of gross monthly income − existing monthly debt) ÷ monthly rate

Rate comes from the credit-score band table (`HELOC_RATES`). Output shows the
estimated line, interest-only draw payment, rate, total equity, projected DTI, and
**which of the two ceilings is limiting you**.

> Note: on the live site this results panel stays stuck on "Enter your home value to
> see estimates" even with valid inputs. This rebuild fixes that — it computes on load
> and on every keystroke.

### SBA page (`sba-loans.html`)
No calculator, by request. Explains 7(a) vs 504, the 50/40/10 split with its
15%/20% exceptions, eligibility standards and document expectations. Carries a
prominent notice that SBA 7(a) cannot be used to buy out MCA positions, citing
SOP 50 10 8 effective 1 June 2025.

This page replaced `long-term-loans.html`. A 301 in `.htaccess` maps the old
URL, placed **before** the clean-URL rewrite — order matters.

### Application (`apply.html`)
Four steps collecting all 29 fields, TMF's own — no handoff to anyone. SSN,
date of birth and the signature are encrypted on arrival with an RSA public
key; the private key lives on John's machine, never the server. The endpoint
refuses submissions if no key is configured. See SETUP-APPLICATION.md.

## Things to wire up

1. **Form submissions.** Wired to a Google Sheet via Apps Script — paste the Web App
   URL into `LEAD_ENDPOINT` at the top of `assets/app.js`. Until it is set, nothing
   is transmitted and the forms say so rather than faking success.
   See `SETUP-LEAD-CAPTURE.md` and `google-apps-script.gs`.
2. **Hero imagery.** Backgrounds are CSS gradients + animated shards rather than the
   photographs on the live site. Drop your own images into `assets/` and set them as
   `background-image` on `.hero-bg` / `.page-hero .hero-bg` if you want the photos back.
3. **Chat widget.** The floating button is styled but inert — hook up your provider.
4. **Fonts** load from Google Fonts (Geist + Geist Mono). Self-host if you prefer.
