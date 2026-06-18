# DealCenter Design System

This document is the source of truth for future DealCenter UI development. It is based on the current implementation in `src/styles.css`, `src/layouts/app-layout`, `src/components/ui`, and the existing feature pages for dashboard, opportunities, change monitoring, settings, and auth.

## Brand Identity

DealCenter is a compact, data-heavy opportunity intelligence product. The visual language is restrained, operational, and desktop-first: warm concrete surfaces, charcoal structure, blue accents for action and information, red for urgency, green for positive/available states, and amber for warnings or transitional statuses.

### Color Tokens

Canonical tokens live in `src/styles.css` as Tailwind v4 CSS variables.

| Role | Token | Value | Usage |
|---|---|---:|---|
| Background | `--background` | `oklch(0.975 0.004 80)` | App canvas, auth form side, page background |
| Surface | `--surface` | `oklch(0.985 0.003 80)` | Header, form fields, subtle elevated areas |
| Surface 2 | `--surface-2` | `oklch(0.955 0.005 80)` | Secondary tonal layer |
| Foreground | `--foreground` | `oklch(0.235 0.005 50)` | Primary text, charcoal UI |
| Card | `--card` | `oklch(0.99 0.003 80)` | Panels, cards, popover-like containers |
| Primary | `--primary` | `oklch(0.68 0.14 240)` | Blue accent, active state, filters, chart series |
| Secondary | `--secondary` | `oklch(0.94 0.005 80)` | Hover fills, chips, muted blocks |
| Muted | `--muted` | `oklch(0.945 0.004 80)` | Disabled and loading backgrounds |
| Muted foreground | `--muted-foreground` | `oklch(0.5 0.008 60)` | Helper text, metadata, labels |
| Accent | `--accent` | `oklch(0.93 0.01 240)` | Generic shadcn hover/accent states |
| Error / Critical | `--destructive` | `oklch(0.605 0.21 28)` | Hot tier, risks, failed pipeline, destructive states |
| Success | `--success` | `oklch(0.62 0.13 155)` | Available, positive status, high-fit signals |
| Warning | `--warning` | `oklch(0.72 0.15 70)` | Bidding/status change and medium-fit states |
| Info | `--info` | `oklch(0.68 0.14 240)` | Informational states and warm tiers |
| Border | `--border` | `oklch(0.9 0.005 70)` | Default dividers and card borders |
| Strong border | `--border-strong` | `oklch(0.82 0.006 70)` | Hover/active borders |
| Input border | `--input` | `oklch(0.9 0.005 70)` | Inputs and readonly values |
| Focus ring | `--ring` | `oklch(0.68 0.14 240)` | Focus states |
| Sidebar | `--sidebar` | `oklch(0.235 0.005 50)` | Main navigation background |

Hard-coded aliases currently used in pages:

- Charcoal: `#232323`, exposed through `.text-charcoal` and `.bg-charcoal`.
- Blue: `#339CEC`, equivalent to the primary/info accent.
- Red: `#de422f`, equivalent to destructive/critical.
- White is used in a few charcoal actions and auth/sidebar marks; prefer semantic foreground tokens where possible.

Chart colors are `--chart-1` blue, `--chart-2` red, `--chart-3` charcoal, `--chart-4` amber, and `--chart-5` green. Use these for Recharts and compact metrics.

### Color Rules

- Use warm off-white backgrounds with charcoal text. Do not introduce pure gray/cool slate surfaces.
- Use blue for primary accent, active filters, focus rings, links, info states, and key chart lines.
- Use charcoal for primary business actions when the action is not specifically blue-coded, such as sign in, run intelligence, assign, and view opportunity.
- Use red sparingly for hot tier, critical risk, failed run, blockers, and urgent highlights.
- Use green for availability, successful/positive indicators, and excellent-fit scoring.
- Use amber for bidding/status-change/warning states.
- Keep accent color rare. The UI should not become blue-heavy.

## Typography

Font tokens are defined in `src/styles.css`.

| Role | Font family |
|---|---|
| Sans | `"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif` |
| Mono | `"JetBrains Mono", ui-monospace, monospace` |

Global font features: `"cv11"`, `"ss01"`, `"ss03"`. Numeric data should use `.num`, `tabular-nums`, or `font-mono` where alignment matters.

### Type Scale

| Role | Current pattern | Usage |
|---|---|---|
| Page title | `text-[22px] font-semibold tracking-tight` | Page headers: Opportunities, Settings, Executive briefing |
| Drawer title | `text-[20px] font-semibold tracking-tight leading-snug` | Opportunity drawer header |
| Card/opportunity title | `text-[15.5px] font-semibold leading-snug` | Project names in cards |
| Panel title | `text-[13px]` to `text-[14px] font-semibold` | Dashboard panels, settings cards |
| Body text | `text-[12.5px]` to `text-[13px]` | Dense content, rows, descriptions |
| Header title | `text-[15px] font-semibold tracking-tight` | App header route title |
| Labels | `text-[10.5px]` to `text-[11.5px] uppercase tracking-wider font-medium/semibold` | KPI labels, form labels, section labels, badges |
| Helper/meta text | `text-[11px]` to `text-[12px] text-muted-foreground` | Timestamps, hints, subtitles |
| Big metric | `text-[20px]`, `text-[22px]`, `text-[28px]`, `text-[40px] font-semibold tabular-nums` | Metric cells, KPI cards, drawer revenue hero |

### Typography Rules

- Use Inter for all UI text. Do not add display fonts.
- Use uppercase tracking for labels, metadata, badge text, and section headers only.
- Keep headings compact and task-oriented; avoid marketing hero typography inside app screens.
- Use `tracking-tight` for major numeric or title emphasis.
- Use tabular numbers for scores, currency, ranks, counts, and dates.

## Spacing System

Tailwind’s standard spacing scale is used directly. The app favors compact, repeatable spacing.

| Pattern | Classes | Usage |
|---|---|---|
| Main app header height | `h-14` | Top header, sidebar brand row |
| Sidebar width | `w-60` | Persistent desktop sidebar |
| Page padding | `px-6 py-6`, sometimes `lg:px-8` | Main pages |
| Page max width | `max-w-[1440px]`, `max-w-[1500px]`, `max-w-[1400px]`, settings `max-w-[1100px]` | Centered content columns |
| Section stack | `space-y-5`, `space-y-6`, drawer `space-y-7` | Vertical page rhythm |
| Grid gaps | `gap-3`, `gap-4`, `gap-5`, settings `gap-6` | Cards, charts, master-detail settings |
| Dense metric grid | `gap-px bg-border border rounded-md overflow-hidden` | Connected KPI tile strips |
| Card padding | `p-3.5`, `p-4`, `p-5`, primitives use `p-6` | Based on density and importance |
| Controls | `h-8`, `h-9`, `h-10`; horizontal `px-3` to `px-4` | Buttons, inputs, filters |
| Badges/chips | `h-5 px-1.5` or `h-5 px-2` | Status and service chips |

Use `rounded-md` for most controls and panels, `rounded-lg` for popovers/empty states, and `rounded-xl` only for high-emphasis opportunity/KPI cards.

## Layout Patterns

### App Shell

The authenticated app uses a fixed-height shell:

- Root: `flex h-screen overflow-hidden bg-background text-foreground`.
- Sidebar: fixed `w-60`, charcoal background, full height, border-right.
- Header: fixed `h-14`, `bg-surface`, bottom border, title on the left, actions/search on the right.
- Main: scrollable `overflow-y-auto`, content centered with max width.

Use this pattern for all authenticated pages.

### Dashboard Layout

Use for overview and executive summary screens:

- Page header with uppercase context label, `22px` title, and right-aligned refresh/status metadata.
- Metric strip using connected cells: `grid ... gap-px bg-border border rounded-md overflow-hidden`.
- Chart panels in `lg:grid-cols-3`, with larger panels spanning two columns where useful.
- Tables or ranked lists below charts.

### Opportunities Layout

Use for searchable, filterable work queues:

- Header with title, count summary, and primary workflow action.
- KPI cards above filters.
- Sticky filter bar with search, popover filters, toggle filter, sort select, and active filter pills.
- Results rendered as full-width clickable cards, not a dense table, when each result has mixed content and actions.
- Detail drawer opens from the right.

### Detail Drawer Layout

Use for opportunity details and future rich object detail views:

- Overlay: `fixed inset-0 bg-black/45 backdrop-blur-[1px]`.
- Drawer: right side, `w-[720px] max-w-[94vw]`, `bg-background`, `border-l`, `shadow-2xl`, `transition-transform`.
- Sticky drawer header with ID/status badges, title, metadata, and primary actions.
- Body uses stacked sections with uppercase section labels and compact cards.

### Settings Layout

Use for configuration pages:

- Left local nav `w-52` with vertical tab buttons.
- Right content column `space-y-5`.
- Settings cards use `bg-card border border-border rounded-md p-5`.
- Rows use two-column label/control layout with `py-3 border-b`, hint text under label, control right-aligned.

### Auth Layout

Use only for unauthenticated flows:

- Split screen on desktop.
- Left brand panel is charcoal with sparse grid texture and small metrics.
- Right form panel is centered, `max-w-sm`, simple vertical form.
- On mobile, hide the brand panel and show compact logo above form.

## Components

Prefer components from `src/components/ui` before adding new primitives. Existing feature pages sometimes use inline variants; match their visual language when extracting future reusable components.

### Button

Purpose: actions, filter triggers, card CTAs, icon actions.

Variants:

- `Button` primitive variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`.
- Common app primary action: charcoal background, white text, `h-8` or `h-9`, `rounded-md`, `text-[12.5px] font-medium`, lucide icon.
- Blue action: use `bg-primary text-primary-foreground` only for accent-coded recommendations or canonical primary UI.
- Error retry: `bg-destructive/10 text-destructive border border-destructive/30`.
- Icon button: square `size-8` or `size-9`, `rounded-md`, border/background for secondary actions.

States:

- Hover: `hover:bg-primary/90`, `hover:bg-secondary`, `hover:bg-charcoal/85`, or `hover:opacity-90`.
- Focus: use visible ring, `focus-visible:ring-1` or `focus:ring-2 focus:ring-ring/30-40`.
- Disabled/loading: muted background, muted foreground, `cursor-not-allowed`, spinner icon if running.

Dos:

- Pair action labels with lucide icons when the action benefits from quick scanning.
- Keep button heights to `h-8`, `h-9`, or `h-10`.
- Use `text-[12.5px]` or `text-sm` depending on density.

Don'ts:

- Do not invent large pill buttons for app screens.
- Do not use blue for every primary-looking action; charcoal is established for many business actions.

### Card / Panel

Purpose: grouped dashboard data, settings sections, opportunity summaries, drawer sections.

Variants:

- Standard panel: `bg-card border border-border rounded-md p-4`.
- Settings card: `bg-card border border-border rounded-md p-5`.
- Opportunity card: `rounded-xl border bg-card p-5 transition-all`.
- KPI card: `rounded-xl border bg-card p-4` with small tone indicator.
- Connected metric cells: individual `bg-card p-3.5` inside `gap-px bg-border`.

States:

- Hoverable cards use `hover:border-border-strong` and a light shadow: `hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]`.
- Clickable rows/cards use `cursor-pointer` and `hover:bg-secondary/40`.

Dos:

- Use borders and tonal layering as the default depth model.
- Use `rounded-md` for ordinary panels and `rounded-xl` for high-value cards.
- Keep panel headers compact: title `13-14px`, subtitle `11-12px`.

Don'ts:

- Do not nest decorative cards inside cards.
- Do not use heavy shadows as the default rest state.
- Avoid colored side stripes except where the current UI has established urgent/hot/action emphasis.

### Input

Purpose: search, auth fields, form controls, readonly values.

Default primitive: `h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base md:text-sm`.

Observed app variants:

- Search input: `h-8` or `h-9`, icon at left, `pl-8`/`pl-9`, `text-[12.5px]` or `text-[13px]`.
- Auth input: `h-10`, `bg-surface`, `text-[13.5px]`.
- Readonly value: `h-9`, `border-input`, `bg-background`, `num`, right-aligned.

States:

- Focus: `focus:outline-none focus:ring-2 focus:ring-ring/30-40 focus:border-ring/50-60`.
- Disabled: `cursor-not-allowed opacity-50`.

### Select

Purpose: compact option choice, currently sort selection and shadcn select primitive.

Use `h-9 rounded-md border border-border/input bg-card/background px-2.5 text-[12.5px]`.

States:

- Focus ring should match inputs.
- Popover menus use `bg-popover border border-border rounded-md shadow-md`.

### Filter Popover

Purpose: multi-select filters in work queues.

Trigger:

- `h-9 px-3 rounded-md border bg-card text-[12.5px] flex items-center gap-1.5`.
- Inactive: `border-border text-muted-foreground hover:text-foreground`.
- Active: `border-primary/40 text-foreground`.
- Count badge: `bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-semibold`.

Content:

- Absolute panel, `mt-1.5`, `bg-popover`, `border`, `rounded-lg`, `shadow-lg`, `min-w-[220px]`, `p-1.5`.
- Checkbox rows: `px-2 py-1.5 rounded-md text-[12.5px] hover:bg-secondary`.

### Badge / Chip

Purpose: status, tier, alert, services, active filters.

Patterns:

- Status/tier badge: `inline-flex items-center h-5 px-1.5 rounded text-[10.5px] font-medium border tracking-wide`.
- Tier badges use uppercase.
- Service chips use `h-5 px-2 rounded-md bg-secondary text-[10.5px] font-medium`.
- Active filter pills use `h-6 rounded-full bg-secondary text-[11.5px]`.

Tone mapping:

- Hot/critical: red tint, red text, red border.
- Warm/new/info: blue tint, blue text, blue border.
- Bidding/status changed: amber tint.
- Award/construction/success: green tint.
- Neutral/updated: warm neutral tint.

### Table

Purpose: compact ranked data where row shape is regular.

Current table pattern:

- Wrapper panel: `bg-card border border-border rounded-md`.
- Table text: `text-[12.5px]`.
- Header: `text-[10.5px] uppercase tracking-wider text-muted-foreground`.
- Header cells: `font-medium py-2`.
- Body rows: `divide-y divide-border`, hover `hover:bg-secondary/40`.
- Body cells: `py-2.5`.
- Numeric columns: right align with `num font-medium`.

Use the `Table` primitive for new reusable tables, but override typography to match the current dense table pattern.

### Modal / Dialog

Purpose: short confirmations or constrained forms. The existing app primarily uses a right-side drawer for rich detail.

Primitive:

- Overlay: `fixed inset-0 z-50 bg-black/80`.
- Content: centered, `max-w-lg`, `border bg-background p-6 shadow-lg`, `sm:rounded-lg`.
- Close button top-right with focus ring.

Use modals sparingly. Prefer inline expansion, popovers, or the established detail drawer for complex object information.

### Drawer / Sheet

Purpose: rich detail and action flow without leaving the list context.

Preferred app drawer:

- `fixed top-0 right-0 h-screen w-[720px] max-w-[94vw]`.
- `bg-background border-l border-border z-50 shadow-2xl shadow-charcoal/10`.
- Slide in/out with `transition-transform`.
- Close with Escape, overlay click, and visible `X`.

For new drawers, prefer the shared `Sheet` primitive if it can be styled to this same geometry and behavior.

### Alert

Purpose: warnings, destructive feedback, and important system messages.

Primitive:

- `rounded-lg border px-4 py-3 text-sm`.
- Destructive: `border-destructive/50 text-destructive`.

Current feature pages often use inline red-tinted cards for blockers and failed run states. Keep icon + text + red tint consistent.

### Empty State

Purpose: no results, unavailable settings data.

Patterns:

- No filter results: centered `py-16` to `py-20`, `text-[13px] text-muted-foreground`, optional lucide icon with `opacity-40`, clear action link.
- Settings placeholder: `rounded-md border border-dashed border-border bg-background px-4 py-6 text-[12.5px] text-muted-foreground flex items-center gap-2`.

Do not use large illustrative empty states in dense app screens.

### Loading State / Skeleton

Purpose: waiting for content or pipeline execution.

Patterns:

- Skeleton primitive: `animate-pulse rounded-md bg-primary/10`.
- Running pipeline button: disabled muted button with `Loader2 animate-spin`, stage label, and truncated text.
- Prefer skeletons or inline button progress over full-page spinners.

### Icons

Use `lucide-react`. Common sizes:

- Navigation: `size-4`, `strokeWidth={1.75}`.
- Buttons and inline actions: `size-3.5`.
- Badges: `size-2.5` to `size-3`.
- Empty states: `size-6`.

Do not mix icon libraries.

## Forms

### Structure

- Labels sit above fields.
- Form labels use `text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground`.
- Label rows may include a trailing action such as “Forgot password?”.
- Field height is `h-9` for app controls and `h-10` for auth.
- Use `rounded-md`, `border-input`, and `bg-surface` or `bg-background`.

### Validation

- Required fields use native `required` where simple validation is enough.
- Error states should use `destructive` text/border and a concise helper message below the field.
- Destructive form feedback should match `RunPipelineButton` failed state: red-tinted background, red text, red border, icon where useful.

### Button Placement

- Auth forms use a full-width submit button after fields.
- Settings rows place controls right-aligned.
- Drawer actions sit in a horizontal row below the drawer header metadata.
- In multi-action rows, primary action comes first unless an external/open action is explicitly pushed to the right.

## Tables

Use tables for compact, comparable rows. Use cards when rows contain multiple zones, mixed metadata, action buttons, and status summaries.

Table standards:

- Header row: uppercase `10.5px`, muted, medium weight.
- Body row text: `12.5px`.
- Row vertical padding: `py-2.5`.
- Header padding: `py-2`.
- Dividers: `divide-y divide-border` or row `border-b`.
- Hover: `hover:bg-secondary/40` or primitive `hover:bg-muted/50`.
- Numeric alignment: right-align currency/counts, use `.num` or `tabular-nums`.
- Score columns may use a compact number plus progress bar.

Sorting/filtering:

- Sorting currently lives above results as a compact select, not clickable table headers.
- Filtering uses the sticky filter bar with popover filters and active filter pills.
- If sortable table headers are added, preserve the same header typography and add a small lucide sort icon.

Pagination:

- No pagination pattern is currently implemented.
- For future pagination, use compact controls at the bottom-right of the table panel and keep row density unchanged.

Empty state:

- Use centered muted text with optional icon and a direct recovery action such as “Clear filters”.

## Dashboard Patterns

### KPI Cards and Metric Cells

Use two KPI patterns:

- Connected metric strip for dense dashboard summaries. Use `gap-px bg-border border rounded-md overflow-hidden`; cells are `bg-card p-3.5`.
- Separate KPI cards for queue summaries. Use `rounded-xl border bg-card p-4`, icon tile, uppercase hint, large tabular value, and small muted label.

### Metrics

- Labels are uppercase `10.5px`.
- Values use `20px`, `22px`, `28px`, or `40px` depending on importance.
- Always use tabular numerics.
- Include concise helper text under the metric.

### Charts

- Use Recharts.
- Grid lines use `oklch(0.9 0.005 70)`.
- Axis ticks use `11px` muted text.
- Tooltips use light background, `border: 1px solid oklch(0.82 0.006 70)`, `borderRadius: 6`, `fontSize: 12`.
- Primary chart series are blue; hot/critical series are red; neutral comparisons can use charcoal.

### Insight and Recommendation Sections

In drawers, recommendation sections use blue-tinted backgrounds, primary border, icon tile, uppercase label, concise action copy, and a primary CTA. Keep recommendation content actionable, not decorative.

## UX Principles

- Prioritize speed and scanning over visual flourish.
- Maintain high information density while preserving clear grouping.
- Keep users in context: use sticky filter bars and right-side drawers rather than route changes for details.
- Prefer progressive disclosure: cards show enough to triage, drawers show the complete brief.
- Use familiar product UI conventions: side nav, top header, filters, tables, popovers, drawers.
- Treat color as state and priority, not decoration.
- Optimize for desktop workflows; mobile should remain usable through wrapping, max widths, and drawer `max-w-[94vw]`.

## Interaction Patterns

### Hover

- Buttons: subtle background or opacity change.
- Cards: stronger border and very light shadow.
- Rows: `hover:bg-secondary/40`.
- Sidebar/settings nav: muted item becomes `hover:bg-secondary/50` or sidebar accent.

### Focus

- Inputs and controls use `ring` in the primary blue family.
- Use `focus-visible` for keyboard focus where possible.
- Do not remove outlines without replacing them with a visible ring.

### Loading

- Disable the triggering control.
- Show `Loader2 animate-spin` for button-level actions.
- Use skeleton blocks for content-level loading.
- Truncate long running labels in constrained buttons.

### Disabled

- Use muted foreground/background.
- Add `cursor-not-allowed`.
- Reduce opacity to `50%` when using shared primitives.

### Success Feedback

- Use green text/tint and a small dot or check icon.
- Keep messages brief and close to the triggering surface.

### Error Feedback

- Use destructive red tint, red border, and clear retry path.
- Avoid blocking the full screen unless the entire page failed.

## Accessibility Standards

- Maintain strong contrast between charcoal text and warm backgrounds.
- Use semantic buttons for actions and anchors for external links.
- Icon-only buttons require `aria-label`.
- Drawers must support Escape close and visible close buttons.
- Preserve keyboard focus indicators with `focus-visible:ring` or equivalent.
- Form inputs must have visible labels, not placeholders only.
- Use `role="alert"` for alert components.
- Keep interactive target heights at least `h-8`, preferably `h-9` or `h-10`.
- Do not rely on color alone for critical state; pair color with labels, icons, or text.

# Rules For New Screens

- Always reuse existing components from `src/components/ui` and feature components before creating new primitives.
- Follow the existing Tailwind token palette from `src/styles.css`.
- Maintain the warm concrete background, charcoal text, blue accent, red critical, green success, and amber warning model.
- Use the established app shell: sidebar, `h-14` header, scrollable main content, centered max-width page.
- Use `px-6 py-6` page padding unless a route has a specific need.
- Use page titles at `22px`, panel titles at `13-14px`, body text around `12.5-13px`, and uppercase labels around `10.5-11.5px`.
- Prefer cards, panels, metric strips, drawers, popovers, and tables that match existing patterns over custom containers.
- Follow existing table density: small uppercase headers, `12.5px` body, subtle row hover, tabular numeric alignment.
- Match dashboard structure with metric strips, compact cards, Recharts panels, and concise insights.
- Use sticky filter bars for work queues with search, popover filters, sort select, active filter pills, and clear actions.
- Use right-side drawers for rich record details instead of navigating away.
- Use established loading, disabled, empty, success, and error states.
- Use lucide icons only, with the current size conventions.
- Keep border radii restrained: `rounded-md` by default, `rounded-xl` only for prominent cards.
- Do not introduce new colors, shadows, font families, gradients, or component variants without a clear product reason.
- Do not create decorative landing-page patterns inside authenticated app screens.

# Instructions For AI Assistants

When generating new DealCenter pages or components:

- Follow this design system strictly.
- Base new UI on actual tokens in `src/styles.css`.
- Reuse existing primitives and feature patterns before inventing anything.
- Prioritize consistency, density, and task clarity over creativity.
- Do not introduce new colors unless the current semantic palette cannot express the state.
- Do not introduce new component variants unless the existing variants fail a real use case.
- Match the current visual language: warm surfaces, charcoal structure, blue operational accent, compact typography, small labels, subtle borders, and low-shadow depth.
- Keep AI-generated screens from feeling generic by copying the application’s specific proportions, type sizes, label treatments, filter bars, drawer layout, metric cards, table density, and status badges.
