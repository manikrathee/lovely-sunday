# Design system

The site's visual language is defined once, in `src/styles/vars.css`, and consumed everywhere else. The root is `html { font-size: 62.5% }`, so **1rem = 10px** throughout.

## Tokens

| Group | Tokens | Notes |
|---|---|---|
| Containers | `--container` 118rem, `--container-wide` 144rem, `--container-prose` 72rem, `--gutter` | Header, footer, and page content share `--container`; galleries may use `--container-wide`; posts use `--container-prose`. Centre with `width: min(100%, var(--container))` or the `.container*` utilities in `layout.css`. |
| Spacing | `--space-1`…`--space-9` (0.4→9.6rem), `--section-gap`, `--block-gap`, `--grid-gap` | Section gap between page sections, block gap inside a section, grid gap for photo grids. No negative margins. |
| Type | `--text-xs/sm/md/lg/xl/2xl/3xl/display`, `--leading-tight/snug/body`, `--tracking-label/display` | Fluid clamps. Body is `--text-md`; `global.css` maps h1–h6 onto the scale with no per-breakpoint overrides. |
| Radii | `--radius-sm/md/lg/pill` | Radius lives on media containers (`overflow: hidden`), never on `img`, so hover zoom keeps its corners. The home hero arch is the one deliberate exception. |
| Motion | `--ease-out`, `--dur-fast/base/slow`, `--reveal-duration`, `--reveal-distance`, `--hover-scale` | Every transition references these. No literal durations or curves. |

## Type roles (`global.css`)

- `.eyebrow` — accent-coloured uppercase sans label (page kickers).
- `.label` — uppercase sans label: nav, footer nav, panel titles, card titles.
- `.section-title` — display face at `--text-2xl` for section headings.
- `.lead` — large intro paragraph.
- `.pill` — mixed-case sans text inside CTA pills.

## Motion (`animations.css`, `src/scripts/reveal.ts`)

- **Scroll reveal:** add `data-reveal` to an element and it fades/rises in when it enters the viewport, with a short cascade for items that enter together. `data-reveal-watch` observes without hiding (the footer uses it to start the wordmark draw). An inline script in `Layout.astro` adds `html.reveal-ready` only when `IntersectionObserver` exists and reduced motion is off, so nothing is hidden without JS. The runtime re-binds after every Swup navigation.
- **Page transitions:** Swup crossfade plus a 12px rise over `--dur-base`. Nothing animates on first load.
- **Hover:** linked media zooms by `--hover-scale` over `--dur-slow`; gallery frames use a gentler 1.01; nav and footer links grow an accent underline from the left; inline links draw a 1px underline; pills lift 1px.
- **Reduced motion:** all of the above collapse to static under `prefers-reduced-motion: reduce`.

## Header state

`Header.astro` gives each link a space-separated `data-section` list; `reveal.ts` sets `aria-current="page"` from `location.pathname` after every navigation (server-rendered for the first load).

## Build-gate constraints

Keep exactly one `<h1>` per page, keep `.legacy-page-gallery`, `.legacy-page-frame`, `.is-half-span` and `img[data-image-dimensions]` on legacy galleries, and never introduce class names or strings containing `sqs-` or `agentation`.
