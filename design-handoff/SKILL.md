---
name: brand-platform-design
description: Use this skill to generate well-branded interfaces and assets for Brand Platform (Бренд-платформа) by the Russian brand agency Чирков & Партнёры (ЧиП) — either for production or throwaway prototypes/mocks. Contains design guidelines, colors, type, fonts, brandbook logos, and a React-based UI kit recreation of the shell + core screens.
user-invocable: true
---

Read the `README.md` file within this skill first — it is the single entry point and contains:

- Product + audience context (who ЧиП are; why this is a premium B2B tool).
- All four user roles (`chip_admin`, `chip_manager`, `marketer`, `owner_viewer`).
- **CONTENT FUNDAMENTALS** (Russian voice, no emoji, sentence shapes, banned phrases, LLM-vendor naming rules).
- **VISUAL FOUNDATIONS** (palette, typography, spacing, corners, shadow/border system, motion, interactive states, density rules).
- **ICONOGRAPHY** (lucide-react only, default sizes, logo usage including the `logo-invert` filter).
- An index of every other file in this skill.

Other files:

- `colors_and_type.css` — single source of truth. **Import this** into any new prototype — it defines CSS custom properties for colors, type scale, spacing, radius, shadow, motion, and applies base element styles. Do not redefine these tokens in prototypes.
- `fonts/` — IBM Plex Mono TTFs (5 weights), already wired by the CSS above. Inter is imported from Google Fonts at the top of the CSS file.
- `assets/` — brandbook logos and favicons. **Never redraw them as SVG**; reference the PNGs. On dark fields apply `.logo-invert` = `filter: invert(1) brightness(1.15)`.
- `preview/` — small design-system cards (tokens + components). Good for visual spot-checking.
- `ui_kits/brand-platform/` — clickable React recreation of the product: Sidebar, Header, Login, Dashboard, Projects, Wizard (Stage 2), Approvals, Admin. Use its `kit.css` + component JSX as reference for composing new screens.

If creating visual artifacts (slides, mocks, throwaway prototypes):
1. Create a new HTML file at the project root.
2. `<link rel="stylesheet" href="colors_and_type.css" />` (or the ui-kit's `kit.css` if you also want primitives).
3. Copy needed logos out of `assets/`.
4. Use lucide-react (or the inline `Icon.jsx` set in the ui-kit) for icons. Never emoji.
5. Write copy in Russian, sentence-case, no exclamations, no «BP» / «Brand Platform» (use «Бренд-платформа»).

If working on production code: the existing codebase (React + Vite + TypeScript + Tailwind v4 + Zustand + lucide-react) already wires these tokens in `src/styles/index.css`. Read the rules in `README.md` to act as an expert designer inside that codebase. The hard-constraints in the README's "Invariants" list are non-negotiable (sidebar `#1A1A1A`, no avatar dropdown in header, no dark mode, card radius 20 / button radius 12, etc.).

If the user invokes this skill without other guidance, ask what they want to build — a new screen inside the product? A marketing page? A slide deck? An internal admin tool? — then ask 3–5 focused questions (screen goals, role context, data on screen, whether variations are wanted) before starting. Act as an expert designer who outputs either HTML artifacts or production Tailwind+TSX, depending on the need.
