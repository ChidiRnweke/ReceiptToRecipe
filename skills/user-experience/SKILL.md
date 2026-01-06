---
name: r2r-design-system
description: Applies the "Warm Rationalist" design system to UI components. Use when writing Tailwind CSS, creating Svelte pages, or styling the Receipt2Recipe application.
---

# R2R Design System: "The Digital Kitchen"

The UI should feel like a clean, sunlit countertop. It avoids sterile SaaS aesthetics in favor of a "warm rationalism." It is intellectual but hospitable.

## 1. Typography: The "Editorial" Pairing
- **Headings (Serif):** Use for Page Titles and Recipe Names to evoke a cookbook feel.
  - *Font Family:* `font-serif` (Configured as Newsreader/Fraunces).
  - *Usage:* `text-3xl font-serif font-medium tracking-tight`.
- **Body/UI (Sans-Serif):** Use for inputs, buttons, tables, and density.
  - *Font Family:* `font-sans` (Configured as Geist/Inter).
  - *Usage:* `text-sm text-ink-light`.

## 2. Color Palette: "Paper and Ink"
Avoid pure black (`#000000`) and pure white (`#FFFFFF`).

- **Backgrounds (Paper):**
  - Base: `#FDFCF8` (Warm Cream) -> Tailwind: `bg-paper`
  - Secondary: `#F4F1EA` (Oat) -> Tailwind: `bg-paper-dark`
- **Text (Ink):**
  - Primary: `#1A1A1A` (Charcoal) -> Tailwind: `text-ink`
  - Secondary: `#4A4A4A` (Deep Slate) -> Tailwind: `text-ink-light`
- **Accents (Organic):**
  - **Sage (Primary Action):** `#768A76` -> `bg-sage-600`
  - **Burnt Sienna (Destructive/Alert):** `#C87A68` -> `text-sienna-600`
  - **Sand (Borders):** `#E5E0D6` -> `border-sand`

## 3. Surface & Depth
- **Borders > Shadows:** Rely on `border-1 border-sand` rather than drop shadows.
- **Radius:** Moderate rounding. Use `rounded-lg` or `rounded-xl`.
- **Glass:** Use generic backdrops sparingly. Prefer solid "Paper" backgrounds to maintain the physical feel.

## 4. Layout & Spacing
- **Whitespace:** High density of whitespace. `p-6` or `p-8` for main containers.
- **Reading Width:** constrain recipe views to `max-w-prose` or `max-w-2xl` to mimic book columns.

## 5. Interactive Elements
- **Buttons:**
  - Primary: `bg-ink text-paper rounded-lg hover:bg-ink/90 active:scale-95 transition-transform`.
  - Secondary: `border border-sand bg-transparent text-ink hover:bg-paper-dark`.
- **Loading:**
  - Use "shimmer" skeletons colored `bg-paper-dark` instead of spinning loaders.