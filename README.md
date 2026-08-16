# TMF Line — static rebuild

A dependency-free rebuild of tmfline.online. No build step, no framework — open
`index.html` in a browser or drop the folder on any static host (Netlify, Vercel,
Cloudflare Pages, S3, nginx).

```
index.html              Home — hero, funding calculator, products, why-us, stages, CTA
funding-estimator.html  3-step cash-injection calculator + live product matching
heloc-calculator.html   Live HELOC estimator + FAQ accordion
long-term-loans.html    Use cases, benefits, payment estimator, qualification, FAQ
mca.html                Process timeline, remittance mechanics, ideal-for, FAQ
about.html              Mission, approach, stats
contact.html            Contact form (front-end only)
assets/styles.css       Whole design system — tokens at the top of the file
assets/app.js           Every interaction and both calculators
build_pages.py          Optional. Regenerates the 5 content pages from shared shells.
```

## Design tokens

All colours, radii and fonts live in `:root` at the top of `assets/styles.css`.
Change `--accent` / `--accent-2` / `--accent-grad` to reskin the whole site.

## Animations & microinteractions

| Where | What |
|---|---|
| Header | Transparent → blurred on scroll; gradient scroll-progress bar |
| Hero | Seven floating glass shards (CSS keyframes) with scroll parallax |
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

### Term-loan estimator (`long-term-loans.html`)
Standard amortisation: `pmt = P·i / (1 − (1+i)^−n)`. Shows monthly payment, total
repaid, total interest and payment count.

## Things to wire up

1. **Form submissions.** The estimator and contact form are front-end only — they
   validate and render a result but post nowhere. Point them at your CRM/webhook.
2. **Hero imagery.** Backgrounds are CSS gradients + animated shards rather than the
   photographs on the live site. Drop your own images into `assets/` and set them as
   `background-image` on `.hero-bg` / `.page-hero .hero-bg` if you want the photos back.
3. **Chat widget.** The floating button is styled but inert — hook up your provider.
4. **Fonts** load from Google Fonts (Geist + Geist Mono). Self-host if you prefer.
