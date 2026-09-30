# Funding Film — Phase 2: creative direction (frontend-design)

## Thesis: engraved, not low-poly

"Low-poly people" defaults to crypto-explainer clip art. We don't take the
geometry from video games — we take it from **currency engraving**.

Portraits on banknotes have been geometric for two centuries: built from
engraved lines, cross-hatch and rose-engine guilloché. It is the most
institutional imagery in finance. The hero disc is already cut with exactly
that guilloché. So the people in this film are cut by the same instrument.

That is the bridge. It isn't a different website — it's the same engraver's
plate, now cutting people instead of a dial.

## Visual language

**Facet density — sparse.** Large, confident planes. Dense meshes read as a
3D scan; a face wants roughly 200–400 visible facets, closer to a cast bronze
head than a game asset. Each plane must be big enough to catch its own
specular.

**Material.** People are cast and machined: brushed steel `--silver #a9b0aa`
and dark patinated bronze `--etch #2a3530` — the same alloy family as the hero
disc, so they read as objects from that world. The rooms around them are
matte faceted graphite, near-black `--vault`. The figures are the bright thing
in a dark faceted world.

**Lighting.** Identical key to the hero: one hard raking side light, deep
falloff into near-black, rim light picking out facet edges. Raking light across
facets is what makes this premium rather than flat — it produces a real
specular break-up instead of a fill of solid color.

**Mint is light, never material.** `--greenback #86b79a` appears only as
emitted light: screen glow, data trace. Nothing is *painted* mint. Sparingly.

## Camera grammar

**The camera only ever moves forward.** One unbroken dolly-in across all three
beats; it never cuts, never pulls back. Forward motion *is* the metaphor — the
application advancing through the process. That single rule is the discipline
holding the sequence together.

Focal length carries the rhythm:

| Beat | Lens | Feel |
|---|---|---|
| 1 — owner at the desk | long, ~85mm | compressed, portrait-like, dignified |
| 2 — into the machine | wide, ~20mm | exaggerated travel, rush |
| 3 — the analyst | long, ~85mm | settles, composed again |

Calm → rush → calm. Wide in the middle is what makes the push feel fast.

## Brightness arc (functionally required)

Dark → darkest → bright.

Beat 1 sits in near-black with screen glow. Beat 2 is the darkest point,
lit only by mint data light. Beat 3 opens up: the analyst's document is
`--banknote` white and grows in the frame.

This isn't just drama — the estimate section below is light `#e5e8e2`. The film
has to *earn* that flip rather than collide with it, so beat 3 ends looking at
white paper.

## Signature move

At the centre of beat 2, the applicant's figures resolve into **the exact
rose-engine guilloché of the hero disc**. Your file becomes the instrument.

One image, and beat 2 is tied back to the hero with no ambiguity. This is the
only flourish in the sequence; everything else stays quiet.

## Restraint

No text is baked into any frame. The mono chips (`APPLY 0H` etc.) were the
obvious thing to float over each beat — that's the accessory removed before
leaving the house. The film carries it without captions, and keeping type out
of the pixels also keeps it translatable and contrast-safe.

## Keyframes

Three clips chained `start_image` → `end_image`, so four stills:

| # | Depicts | Role |
|---|---|---|
| **K1** | Over-the-shoulder, faceted business owner at a dark desk; glowing screen small in frame; long lens | Clip A start |
| **K2** | Screen now fills the frame — application fields on glass, at the threshold of entering | Clip A end / B start |
| **K3** | Inside the machine. Darkest point. Data resolving into the guilloché plate, mint light | Clip B end / C start |
| **K4** | Emerged. Faceted analyst in a suit, white `--banknote` document bright and large in frame | Clip C end |
