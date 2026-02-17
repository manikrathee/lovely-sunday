# Lovely Sunday — "Atelier Blush" Redesign Plan

## Context

Lovely Sunday is a fashion brand/atelier website (Astro static site) currently using a blue-accent (#3eb0ef) color scheme with a standard 3-column grid. The client selected the "Atelier Blush" design direction — warm minimalism / quiet luxury — inspired by brands like Céline and The Row. The redesign focuses on photography-forward presentation with generous whitespace, refined typography, and a cream/dusty-rose/gold palette.

## Design Tokens — New Palette

```
Light mode:
  --color-primary:  #C9A6A0  (dusty rose)
  --color-base:     #1A1A1A  (warm black)
  --color-border:   #E5DDD5  (warm sand)
  --color-bg:       #FAF7F2  (cream)
  --color-accent:   #C4A265  (gold)

Dark mode:
  --color-primary:  #D4B5AF  (lighter dusty rose)
  --color-base:     #E8E2DC  (warm off-white)
  --color-border:   #3A3530  (dark sand)
  --color-bg:       #171514  (warm dark)
  --color-accent:   #D4B280  (lighter gold)
```

## Typography Strategy

- Keep existing font stack (`EB Garamond` serif, `Futura`/`League Spartan` sans-serif) — they're system/installed fonts, no web font loading needed
- Add a web font for refined headings: `Cormorant Garamond` (Google Fonts, similar to EB Garamond but with more display weights) — loaded via `<link>` in Layout.astro
- Navigation/labels: sans-serif in `letter-spacing: 0.15em; text-transform: uppercase; font-weight: 300`
- Body: serif at comfortable reading size
- Headings: thin-weight serif at large sizes with generous letter-spacing

---

## Implementation Steps

### Step 1: Design System Foundation — `src/styles/vars.css`

Update all CSS custom properties:

- `--color-primary`: `#3eb0ef` → `#C9A6A0`
- `--color-base`: `#131313` → `#1A1A1A`
- `--color-border`: `#ddd` → `#E5DDD5`
- `--color-bg`: `#ffffff` → `#FAF7F2`
- Add new: `--color-accent: #C4A265`
- Add new: `--color-bg-subtle: #F3EDE6` (slightly darker cream for card backgrounds)

Dark mode (`[data-theme='dark']`):
- `--color-primary`: `#5ec2ff` → `#D4B5AF`
- `--color-base`: `#e0e0e0` → `#E8E2DC`
- `--color-border`: `#444` → `#3A3530`
- `--color-bg`: `#121212` → `#171514`
- Add: `--color-accent: #D4B280`
- Add: `--color-bg-subtle: #1E1C1A`

Typography vars (keep existing, add display):
- Add: `--font-display: 'Cormorant Garamond', var(--font-serif)`
- Keep `--font-serif` and `--font-sans-serif` unchanged

Spacing:
- `--radius`: `0.5rem` → `0.2rem` (more refined, less rounded)

### Step 2: Web Font Loading — `src/layouts/Layout.astro`

Add Google Fonts `<link>` in the `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap" rel="stylesheet">
```

### Step 3: Global Base Styles — `src/styles/components/global.css`

**Body:**
- `background: var(--color-bg)` (already uses variable — will cascade)
- `color: var(--color-base)` (already uses variable)
- `font-family`: keep `var(--font-serif)` — no change

**Typography scale — update heading styles:**
- All h1-h6: change to `font-family: var(--font-display)`
- h1: `font-weight: 800` → `font-weight: 300`, add `letter-spacing: 0.04em`
- h2: `font-weight: 500` → `font-weight: 300`, add `letter-spacing: 0.03em`
- h3-h6: `font-weight: 500` → `font-weight: 400`

**Links:**
- `color: var(--color-primary)` — already uses variable, will cascade to dusty rose
- Hover: add `color: var(--color-accent)` (gold on hover)

**Selection color:**
- `background: #cbeafb` → `background: rgba(201, 166, 160, 0.3)` (dusty rose tint)

**Focus states:**
- `:focus-visible outline: 2px solid var(--color-primary)` — cascades automatically
- `input:focus outline`: same — cascades

**Blockquote:**
- `border-left: var(--color-border) 0.5em solid` → `border-left: var(--color-accent) 2px solid` (thinner gold line)

### Step 4: Header Redesign — `src/components/Header.astro` + `src/styles/components/site-shell.css`

**Header.astro template changes:**
- Remove emoji icon buttons (☰, ◉, ⌕, 👜)
- Replace with minimal text navigation links in spaced uppercase:
  ```html
  <header class="site-head">
    <div class="site-head-container">
      <nav class="site-head-left" aria-label="Primary">
        <a href="/lookbook">Discover</a>
        <a href="/news">Archive</a>
      </nav>

      <a class="site-head-logo" href="/">
        <img src="/img/lovely-sunday-logo.svg" alt="Lovely Sunday" />
      </a>

      <nav class="site-head-right" aria-label="Utilities">
        <a href="/about-lovely-sunday">About</a>
        <a href="/contact-lovely-sunday">Contact</a>
      </nav>
    </div>
  </header>
  ```
- Remove AnnouncementBar import (or keep but restyle — see Step 5)

**site-shell.css header changes:**
- `.site-head`:
  - `background: rgba(255, 255, 255, 0.92)` → `background: rgba(250, 247, 242, 0.95)` (cream glass)
  - `box-shadow: 0 10px 20px rgba(19, 19, 19, 0.06)` → `box-shadow: none`
  - `border-bottom: 1px solid rgba(0, 0, 0, 0.05)` → `border-bottom: 1px solid var(--color-border)`
  - Keep `backdrop-filter: blur(8px)`
- `.site-head-container`:
  - `max-width: 1320px` → keep
  - `height: var(--header-height)` → keep clamp function
- New `.site-head-left`, update `.site-head-right`:
  - Navigation links: `font-family: var(--font-sans-serif)`, `font-size: 1.1rem`, `letter-spacing: 0.15em`, `text-transform: uppercase`, `font-weight: 300`, `color: var(--color-base)`, `opacity: 0.6`
  - Hover: `opacity: 1`, `color: var(--color-accent)`
  - `display: flex; gap: 2rem; align-items: center`
- Remove `.icon-button` styles (no longer needed)
- Dark mode: `background: rgba(23, 21, 20, 0.95)`

### Step 5: Announcement Bar — `src/components/AnnouncementBar.astro` + site-shell.css

**Option A (simplify):** Restyle to match Atelier Blush:
- `background: linear-gradient(...)` → `background: var(--color-accent)` (solid gold)
- `color: #fff` → `color: #FAF7F2` (cream text on gold)
- `font-family: var(--font-sans-serif)`, `letter-spacing: 0.1em`, `text-transform: uppercase`, `font-size: 0.85rem`

**Option B (remove):** Remove the AnnouncementBar import from Header.astro entirely for a cleaner look. The footer links provide sufficient discovery. **Recommend Option B** for the quiet luxury aesthetic.

### Step 6: Post Card Grid — `src/styles/components/post-card.css` + `src/styles/layout.css`

**layout.css — post-feed grid:**
- Current: `grid-template-columns: repeat(3, minmax(0, 1fr))`
- New asymmetric layout:
  ```css
  .post-feed {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 2rem;
    max-width: 112rem;
    margin: 0 auto;
  }

  /* Alternate the large/small sides */
  .post-feed .post-card:nth-child(4n+3),
  .post-feed .post-card:nth-child(4n+4) {
    /* These appear on right-heavy rows via natural grid flow */
  }

  /* Every 3rd card spans full width for variety */
  .post-feed .post-card:nth-child(5n+3) {
    grid-column: 1 / -1;
  }
  ```
- Mobile (≤900px): `grid-template-columns: 1fr` (single column, same as current)

**post-card.css changes:**
- `.post-card`: `min-height: 42rem` → remove min-height entirely
- `.post-card-image-wrap`:
  - `background: #f1f1f1` → `background: var(--color-bg-subtle)`
  - `aspect-ratio: 0.8 / 1` → keep for standard cards
  - Full-width cards (`:nth-child(5n+3)`): `aspect-ratio: 16 / 9` (landscape hero)
  - Add `border-radius: var(--radius)` (subtle 0.2rem)
- `.post-card-image`:
  - `filter: brightness(0.98)` → remove filter
  - Add hover: `transform: scale(1.02); transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)`
- `.post-card-content`:
  - `padding: 1.7rem 0.6rem 0` → `padding: 1.5rem 0 0`
  - `text-align: center` → keep
- `.post-card-title`:
  - `font-size: 1.6rem` → `font-size: 1.4rem`
  - Add: `font-family: var(--font-sans-serif)`, `letter-spacing: 0.08em`, `text-transform: uppercase`, `font-weight: 300`
  - `color: var(--color-base)`, `opacity: 0.7`
- `.post-card-link:hover`:
  - Remove `text-decoration: underline` on title
  - Instead: title `opacity: 1` on hover
- `.post-card.no-image`:
  - `border: 1px solid #e6e6e6` → `border: 1px solid var(--color-border)`
  - `background: #fff` → `background: var(--color-bg)`

### Step 7: Content Pages — `src/styles/content.css`

**Page head:**
- `.page-head-title`: add `font-family: var(--font-display)`, `font-weight: 300`, `letter-spacing: 0.04em`
- `.page-head-description`: `opacity: 0.6` → `opacity: 0.5`, `font-style: italic`

**Post content:**
- `.post-content-body`: `color: var(--color-base)` — cascades
- `.post-content-excerpt`: add `font-family: var(--font-display)`, `font-style: italic`
- `.post-content-body pre`:
  - `background: #eeeeee` → `background: var(--color-bg-subtle)`
  - `border: var(--color-border) 1px solid` — already uses variable
- `.post-content-body blockquote`:
  - `border-left: #000 3px solid` → `border-left: var(--color-accent) 2px solid`

**Post navigation:**
- `.post-link`: `border-top: 1px solid #e1e1e1` → `border-top: 1px solid var(--color-border)`

**Author section:**
- `.author-meta color`: use `var(--color-base)` — cascades

### Step 8: Footer — `src/components/Footer.astro` + site-shell.css

**Footer.astro — minimal changes to template** (already clean). Keep structure.

**site-shell.css footer:**
- `.site-foot`:
  - `border-top: 1px solid rgba(0, 0, 0, 0.08)` → `border-top: 1px solid var(--color-border)`
  - `padding: 2rem var(--site-shell-gap) 3rem` → `padding: 3rem var(--site-shell-gap) 4rem` (more breathing room)
- `.site-foot-brand strong`: add `font-family: var(--font-display)`, `font-weight: 300`, `letter-spacing: 0.06em`, `font-size: 1.2rem`
- `.site-foot-nav a`:
  - `font-family: var(--font-sans-serif)`, `letter-spacing: 0.12em`, `text-transform: uppercase`, `font-weight: 300`, `font-size: 0.85rem`
  - `color: var(--color-base)`, `opacity: 0.5`
  - Hover: `opacity: 1`, `color: var(--color-accent)`
- Dark mode: `border-top-color: var(--color-border)` — cascades

### Step 9: Buttons & Forms — `src/styles/components/buttons.css` + `forms.css`

**Buttons:**
- Default button:
  - `background-color: #000` → `background-color: var(--color-base)`
  - `box-shadow: inset 0 0 0 2px #000` → `inset 0 0 0 1px var(--color-base)` (thinner)
  - `border-radius: var(--radius)` — cascades to 0.2rem
  - `font-family: var(--font-sans-serif)`, `letter-spacing: 0.1em`, `text-transform: uppercase`
- Hover:
  - `color: var(--color-primary)` → `color: var(--color-accent)` (gold)
  - `box-shadow`: `inset 0 0 0 1px var(--color-accent)`

**Forms:**
- Input border: `border: solid 1px #131313` → `border: 1px solid var(--color-border)`
- Focus: `border-color: var(--color-accent)`, `box-shadow: 0 0 0 1px var(--color-accent)`
- Label: `color: var(--color-primary)` → cascades to dusty rose

### Step 10: Scroll Animations — `src/styles/components/animations.css`

Add IntersectionObserver-based fade-in for cards. Add to Layout.astro's `<script>`:

```javascript
// Scroll reveal for post cards
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.post-card').forEach((card) => observer.observe(card));
```

Add to animations.css:
```css
.post-card {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.post-card.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Stagger children */
.post-card:nth-child(2) { transition-delay: 0.1s; }
.post-card:nth-child(3) { transition-delay: 0.2s; }
```

Keep existing Swup transition-fade and slideUp animations.

### Step 11: Site Wrapper Background — `src/styles/components/site-shell.css`

- `.site-wrapper`: `background: var(--color-bg)` — cascades to cream
- Remove the dark mode radial gradient (`radial-gradient(circle at top, rgba(62, 176, 239...)`) — that was blue-themed
- Replace with warm subtle gradient:
  ```css
  [data-theme='dark'] .site-wrapper {
    background: radial-gradient(circle at top, rgba(201, 166, 160, 0.05), transparent 50%),
      var(--color-bg);
  }
  ```

### Step 12: Legacy HTML Pages — `src/styles/components/legacy-gallery.css`

Legacy pages inherit global styles. Key overrides:
- Gallery wrapper already uses CSS Grid — colors will cascade
- `.sqs-gallery-design-autocolumns-slide` fade-in: keep existing but match new timing (0.6s)
- Any hardcoded colors in legacy CSS should be overridden to use variables

### Step 13: About Page — `src/pages/about-lovely-sunday.astro`

Scoped styles in this component need updating:
- `.about-page background: #fff` → `background: var(--color-bg)`
- `.panel background: #fafafa` → `background: var(--color-bg-subtle)`
- `.panel border: 1px solid #e4e4e4` → `border: 1px solid var(--color-border)`
- `button background: #222` → `background: var(--color-base)`
- `font-family: Georgia` → `font-family: var(--font-serif)` (use design system)

---

## Files Modified (Summary)

| File | Scope of Changes |
|------|-----------------|
| `src/styles/vars.css` | All color tokens, new accent/display vars |
| `src/layouts/Layout.astro` | Google Font link, scroll observer script |
| `src/styles/components/global.css` | Typography weights, heading font-family, link hover, selection, blockquote |
| `src/styles/components/site-shell.css` | Header glass tint, remove icon-button, nav link styles, footer refinement, wrapper gradient |
| `src/components/Header.astro` | Replace icon buttons with text nav links, remove AnnouncementBar |
| `src/styles/components/post-card.css` | Card sizing, hover effects, title treatment |
| `src/styles/layout.css` | Asymmetric 2-column grid |
| `src/styles/content.css` | Page head, post body, blockquote, navigation |
| `src/styles/components/buttons.css` | Colors, border thickness, letter-spacing |
| `src/styles/components/forms.css` | Border colors, focus states |
| `src/styles/components/animations.css` | Scroll reveal animation classes |
| `src/pages/about-lovely-sunday.astro` | Scoped style color updates |

## Verification

1. `npm run dev` — start Astro dev server
2. Check homepage: cream background, asymmetric grid, rose/gold accents
3. Check dark mode toggle: warm dark palette, no blue remnants
4. Check a work post page: serif headings, proper spacing
5. Check about page: colors updated from scoped styles
6. Check legacy lookbook pages: gallery inherits new colors
7. Test mobile (≤900px): single column, header remains functional
8. Test `prefers-reduced-motion`: animations disabled
9. Lighthouse audit: no regressions in performance/accessibility
