# Brand Platform — Design System

**Product:** «Бренд-платформа» — a B2B SaaS methodology workbench for the Russian brand agency **Чирков & Партнёры (ЧиП)**. A linear 4-stage wizard that walks a marketer + business owner from client-DNA interviews → values → legend/mission → positioning → tested messaging. Every AI-generated draft must be manually approved by the business owner before it's published (architectural invariant, not UX suggestion).

**Audience:** consultants who charge ₽2–4M per project. Visual quality must match. Reference tier: Linear / Stripe / Attio / Notion / Vercel.

**UI language:** Russian only. **Theme:** light only (no dark mode — post-MVP).

---

## Sources used to build this system

- **Codebase** (mounted, read-only): `src/` — React 18 + Vite + TypeScript + Tailwind v4 + Zustand + lucide-react. Key files explored:
  - `src/styles/index.css` — existing CSS tokens (source of truth for colors, radius, shadow, motion).
  - `src/config/platform.ts` — brand copy (name, taglines, features, copyright).
  - `src/components/ui/*` — 15 primitives (Button, Card, Input, Badge, Tabs, Modal, Stepper, ProgressBar, EmptyState, Tooltip, Dropdown, Breadcrumbs, DiffBlock, SuggestionMark).
  - `src/components/Sidebar.tsx`, `src/components/SufflerPanel.tsx`, `src/components/QueueBanner.tsx`, `src/components/Tooltip.tsx`, `src/components/ValidatorBadge.tsx`, `src/components/TimeSavedChip.tsx`, `src/components/OnboardingBanner.tsx`, `src/components/FeedbackForm.tsx`.
  - `src/pages/*` — 16 screens (Login, Dashboard, Projects, ProjectDetail, Stage1–4, Approvals, 7 admin pages).
- **Uploaded assets:** 8 logo files (full-dark, emblem-light/dark, icon-dark/outline, favicon, logo-white) + 5 IBM Plex Mono TTF weights.

---

## Roles & visibility

4 roles, hard-fixed (no more):

| Role           | Who                           | Access                                                |
| -------------- | ----------------------------- | ----------------------------------------------------- |
| `chip_admin`   | Чирков himself (1 person)     | Everything — incl. 7 admin observability pages        |
| `chip_manager` | ЧиП project managers          | Projects they run, no admin                           |
| `marketer`     | Client-side marketer          | The one project they're assigned — wizard + approvals |
| `owner_viewer` | Business owner (the client)   | Only /approvals — approves artifacts. 3–4 visits/project. |

---

## Index — what's in this folder

| Path | What |
| ---- | ---- |
| `README.md` | This file. High-level context + content / visual / iconography fundamentals. |
| `colors_and_type.css` | Single source of truth — CSS custom properties for colors, type scale, spacing, radius, shadow, motion. Copy-paste into any new prototype. |
| `fonts/` | IBM Plex Mono TTFs (5 weights). Inter is imported from Google Fonts via CSS. |
| `assets/` | Logos + favicons from the brandbook. |
| `preview/` | Small HTML cards registered as design-system assets (type, color, spacing, components, brand). |
| `ui_kits/brand-platform/` | Pixel-level HTML+JSX recreation of the product — shell + 4 core screens as a clickable prototype. |
| `SKILL.md` | Agent-skill manifest — how to use this design system when generating new mockups or production code. |

---

## Content fundamentals

The brand-voice is set in `src/config/platform.ts` and is strict:

- **Voice:** прямой, без слэнга, без emoji, без восклицаний. Строгий, профессиональный, но не сухой. «Разговор равных».
- **Sentence shape:** short imperative sentences ending with a period. Example triad:
  «Слушаем клиента. Вытаскиваем мотив. Формулируем без клише.»
- **Pronoun policy:** formal «Вы» addressing the user; product speaks from «мы» when narrating system actions. Never «я».
- **Emoji:** **none**, anywhere in UI. Not in headings, toasts, empty states, or copy. Replaced by `lucide-react` line-icons.
- **Exclamation marks:** avoid. One rare exception: a hard system error («Claude не справился — попробуйте чуть позже» — note: no `!`).
- **Casing:** Russian sentence-case everywhere. Only exception: uppercase-mono micro-labels (IBM Plex Mono, 10px, letter-spacing 0.08em) for section tags like `СТАДИЯ 2` or `ВАШЕ СЛЕДУЮЩЕЕ ДЕЙСТВИЕ`.
- **Product name:** always «Бренд-платформа» (with a hyphen, lowercase 'п'). Company: «Чирков & Партнёры» (with the `&`). Never "BP" in UI, never "Brand Platform" in UI — those are internal.
- **LLM vendor names banned from UI.** Words «Claude», «Anthropic», «GPT-4», «OpenAI» never appear in user-facing text. Single exception: admin `/admin/silent-failures` prompt-run logs. Wait — the codebase does use «Claude готовит черновики» on the Dashboard greeting as the agency's explicit internal framing. Treat that as the *only* sanctioned mention; everywhere else refer to it abstractly («система», «валидатор», «черновик»).
- **Copyright line:** `© {year} Чирков и Партнёры · Бренд-платформа` — with ` · ` (U+00B7, middle dot, spaces around).
- **Date format:** `toLocaleString('ru-RU')` everywhere. No "Dec 24" style.
- **Numbers:** mono + tabular-nums. Thousands separator: `.toLocaleString('ru-RU')` which yields `1 234` with a space.
- **Pluralization:** proper Russian plural forms (день / дня / дней). Example in `src/pages/DashboardPage.tsx`.

Example copy specimens (from the codebase):
- Hero headline: «Линейно. По делу. **Методология 3.1.**»
- Dashboard subtitle: «Claude готовит черновики, вы ставите подпись. Ниже — где вас ждут.»
- Empty state: «Проджект Чиркова создаст первый проект после вводного звонка с клиентом.»
- Approvals warning: «Ваша подпись создаст immutable snapshot. Отменить нельзя.»
- Login footer: «Доступ к платформе выдаёт проджект Чиркова после вводного звонка.»

---

## Visual foundations

### Palette

- **Primary:** Indigo `#4F46E5` (500). Premium-SaaS standard (Linear / Stripe / Vercel). Scale 50→900 is locked; do not invent new indigos.
- **Neutral:** Warm Gray (Stone scale, `#FAFAF9 → #1A1A1A`). **Not** Slate, **not** Zinc. The warm undertone is a deliberate identity choice — it ties to the paper-aesthetic of brand work and matches Linear / Attio neutral.
- **Sidebar background:** `#1A1A1A` (neutral-900), warm. Hard-coded in `src/components/Sidebar.tsx`. Not pure black, not navigation-blue. Never change.
- **Semantic:** green `#22C55E` success, amber `#EAB308` warning, red `#EF4444` danger.
- **Info blue `#3B82F6` is reserved for admin observability only** (silent failures, security events). Never use it in general UI — it would dilute the indigo.
- **Banned accents:** purple `#7C3AED`, any blue outside info-scope, orange `#F97316` (historical primary — fully retired).

### Typography

- Two families, nothing else:
  - **Inter** — body + UI, weights 400/500/600/700/800, Google Fonts.
  - **IBM Plex Mono** — display, numbers, uppercase micro-labels, ID chips, code. Weights 300–700, self-hosted from `fonts/`.
- **Display voice:** brand headlines use Plex Mono SemiBold with `letter-spacing: -0.02em`. This is the single visual signature that tells you you're in the product (see `.font-display`).
- **Numbers are always tabular:** `font-feature-settings: 'zero', 'ss01'` on mono, `tabular-nums` on everything numeric. Slashed-zero on. Dashboards without this feel sloppy.
- **Uppercase-mono labels** (10–11px, letter-spacing 0.08em) are used for section tags — «ВАШЕ СЛЕДУЮЩЕЕ ДЕЙСТВИЕ», «АКТИВНЫХ ПРОЕКТОВ». Never on body copy.

### Spacing & grid

- **4pt grid.** Everything multiple of 4. No `11px`, `13px`, `15px` — those read as "ad-hoc, not a system" immediately.
- Canonical values: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

### Corners

- **Cards:** exactly `20px` (`rounded-2xl`). Not 16, not 24. Hard-cap.
- **Buttons & inputs:** `12px` (`rounded-lg`). Buttons read sharper than cards on purpose — it's the tactility gradient.
- **Small chips / badges:** `6–8px`.
- **Avatars / circular status dots:** full.

### Borders vs shadows

- Default cards: **border only** (`#E7E5E4`), no shadow. This is central to the aesthetic — a Linear-like flat field, not a Material drop-shadow farm.
- Shadows are reserved for *intentionally elevated* surfaces:
  - `shadow-soft-2` (`0 4px 12px rgba(0,0,0,0.06)`) — featured cards, hovered project cards.
  - `shadow-overlay` (`0 12px 40px rgba(0,0,0,0.15)`) — modals, dropdowns.
  - `shadow-focus` (indigo ring, 3px) — keyboard focus.
- **No colored shadows** (no indigo glow, no coloured drop). Neutral rgba only.

### Backgrounds & imagery

- App bg: `#FAFAF9` (neutral-50). Never pure white — pure white feels clinical and washes out the card border contrast.
- **No full-bleed imagery** in-app. The only hero imagery is the Login left-panel, which is a flat dark field plus one very low-opacity (10%) indigo radial glow in the bottom-right corner (see `src/pages/LoginPage.tsx`). That's the extent of decoration.
- **No gradients** outside that single login radial. No gradient buttons, no gradient cards, no "indigo-to-violet" anything.
- **No illustrations, no Lottie, no 3D, no glass/blur effects.** Empty states use a single `lucide-react` line icon centered.
- **Subtle backdrop-blur** on sticky top/bottom action bars only: `bg-white/95 backdrop-blur-md` — lets page content ghost through so the bar feels physically floating above, not painted on.

### Animation

- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (out) for most transitions. `cubic-bezier(0.65, 0, 0.35, 1)` (in-out) for bidirectional ones.
- **Durations:** instant 100, fast 150 (color hovers), base 200 (transforms), slow 300 (sidebar collapse, modal enter), pensive 500 (rare, large layout shifts).
- Entry animations: `fade-in-up` (8px Y, 300ms) on page mount. Delayed variant (`fade-in-delayed`) at 100ms for secondary content.
- Suffler panels: `suffler-in` — 16px X slide + fade, 200ms out-ease.
- `prefers-reduced-motion` is honored globally (reduced to 0.01ms). Always.

### Interactive states (must be explicit — never rely on default browser)

- **Button hover:** background one step darker (500 → 600 for primary, neutral-100 → neutral-200 for secondary). `transition-[background-color,border-color,color,transform] 150ms ease-out`.
- **Button active:** `scale(0.98)` + even darker bg (primary-700). Never on `disabled`.
- **Button focus-visible:** indigo 3px ring (`--shadow-focus`).
- **Input focus:** border indigo-500 + 1px ring indigo-500 + bg flips from `#F5F5F4` to `#FFFFFF`. The bg flip is the key — it's how you feel the field "pick up."
- **Card interactive hover:** border `#E7E5E4 → #A5B4FC` + soft-2 shadow with indigo tint at 8% alpha. Never a full `shadow-soft-2` neutral — that's for other surfaces.
- **Nav active:** solid indigo-500 bg + white text + `rounded-xl`. Nav inactive hover: `bg-[#2A2A2A]` + white text.
- **Disabled:** opacity substitute — use muted color tokens (primary-300 for bg, neutral-400 for fg). Never `opacity: 0.5` on whole element.

### Transparency & layer rules

- Sticky bars: `bg-white/95` + `backdrop-blur-md`. Sidebar is opaque.
- Modal overlay: neutral black at 40% + backdrop-blur. Modal itself is opaque.
- No glassmorphism on cards. No inner shadows.

### Density

- Bloomberg-adjacent on data pages (admin, projects list, silent-failures) — 40px row-height, 14px text.
- Reader density on Approvals center column: max-width 720px, line-height 1.7, 16px text. That's the "documentation-grade" moment.
- Dashboard: `space-y-6` between major groups, `space-y-3` inside lists.

### Layout rules

- Sidebar is `fixed left-0`, width `240 / 64` (expanded / collapsed), `z-40`, background `#1A1A1A`.
- Header is in-flow, per-page, contains ONLY page title + bell icon. No avatar dropdown.
- Content area: `padding: 32px`, `max-width: none` (we want density, not centered columns — except on Approvals document view where we cap at 720px).
- Sticky top action bars sit below the page title, with `backdrop-blur`. Sticky bottom CTAs use `padding-left: calc(var(--sidebar-w, 240px) + 24px)` so they don't underlap the sidebar.

---

## Iconography

- **Single icon system: `lucide-react`.** No FontAwesome, Heroicons, Phosphor, Material. No custom SVG icons. This is non-negotiable — the stroke weight and metric consistency of lucide is what makes the UI feel single-authored.
- **Default sizes:** `w-4 h-4` (16px) inline with body text, `w-5 h-5` (20px) for nav and card headers, `w-3.5 h-3.5` inside badges.
- **Stroke width** stays at the lucide default (1.5). Do not override.
- **Color:** icons inherit `currentColor` and pick up their parent's text color. Accent icons use indigo-500 (card header icons, stat icons) — this is the main place indigo appears outside buttons.
- **Emoji:** banned, per content fundamentals. An 🙂 in a toast would break the tone immediately.
- **Unicode as icons:** only in one place — the middle-dot separator `·` (U+00B7) in meta lines and the copyright string. Treat as typographic, not iconic.
- **Brand logo:** the only raster element in the system. Use the PNG files in `assets/` — never re-draw as SVG, never recolor in code. On dark fields apply `filter: invert(1) brightness(1.15)` (class `.logo-invert`) to the `logo-full-dark.png`. For collapsed sidebar use `logo-emblem-light.png` at 32px.

Representative lucide icons used across the product (for reference while mocking):

| Context | Icon |
|---|---|
| Dashboard cards | `FolderKanban`, `Clock`, `CheckCircle2`, `Wallet`, `Sparkles`, `Users` |
| Wizard state | `PlayCircle`, `Lock`, `CheckCircle2`, `Clock`, `Sparkles`, `RotateCcw`, `Send` |
| Approvals | `ShieldCheck`, `MessageSquare`, `Edit3`, `FileText`, `AlertCircle` |
| Admin | `AlertTriangle`, `BarChart3`, `TrendingDown`, `Target`, `Wallet`, `Shield`, `Users` |
| Navigation | `ChevronLeft`, `ArrowLeft`, `ArrowRight`, `LogOut` |

---

## Known substitutions / flags

- **None for fonts or icons** — both shipped as intended (IBM Plex Mono self-hosted; Inter from Google Fonts; lucide-react from CDN in UI kit previews).
- **Approvals document view** currently uses the sans stack at 16/1.7. The spec suggested "serif-possibly" for documentation-grade feel — we did **not** introduce a third family, because that would break the strict two-family rule. If the user later wants a serif layer, recommend IBM Plex Serif (same family → consistent metrics). Flag: **ask the owner before adding**.
