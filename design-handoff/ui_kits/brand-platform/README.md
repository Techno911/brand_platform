# Brand Platform — UI kit

Pixel-level recreation of the Brand Platform product using React + Babel in the browser. Modular JSX components, shared `kit.css` rooted in `../../colors_and_type.css`.

## Screens (switch from the top-right toolbar in `index.html`)

- **Dashboard** — greeting, next-action chip (urgent variant), 3 stat cards, active-projects list with inline progress, budget widget, onboarding guide.
- **Projects** — search + segmented filter + «Новый проект», 3-column grid, per-card stage + budget progress.
- **Wizard · Stage 2** — sticky top with stage buttons + back link, 3-column layout (stepper / canvas / suffler), sticky bottom action bar with 4 dots + send-for-approval CTA.
- **Approvals** — 3-column split (artifact list / reader-mode document / thread). Sticky action bar scoped to document column.
- **Admin · Silent failures** — chip_admin role: intro card, retry-threshold controls, tabs, Bloomberg-density table.
- **Login** — 40/60 split, dark hero with radial indigo glow, 3 features, form with `h-12` inputs.

## Components

- `Icon.jsx` — lucide-style inline SVG set (1.5 stroke, 24 viewBox) matching the codebase's lucide-react usage.
- `Shell.jsx` — Sidebar + Header + Shell. Dark sidebar `#1A1A1A`, 240px, admin nav group for chip_admin.
- `Dashboard.jsx`, `Wizard.jsx`, `Approvals.jsx`, `Projects.jsx`, `Admin.jsx`, `Login.jsx` — screens.

## Invariants honoured

Sidebar bg `#1A1A1A` · card radius 20 · button radius 12 · no avatar dropdown · no emoji · lucide-only icons · RU-only copy · tabular mono numerals · single focus-ring style.

## How it's wired

React 18.3 UMD + `@babel/standalone`. Each `.jsx` file is loaded as `<script type="text/babel">` and assigns its exports to `window`. The entry script composes them.
