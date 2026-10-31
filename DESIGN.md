# DESIGN.md --- OSY Design System

> **Design bible** for the OSY web app, adapted to the complete
> Venus-style component library delivered by our designer. This document
> is the single source of truth: use tokens, never hardcoded magic
> numbers. Every component below ships with its full state matrix
> (default, hover, focus, active, disabled, loading, success, error)
> because the source design specifies them.

**Core identity:** vivid OSY purple accent, fully-rounded (pill)
interactive elements, large soft radii on containers, soft diffuse
shadows, generous whitespace, Gabarito typography. Calm, premium,
trustworthy productivity tool. OSY's visual reference uses bold purple
fields, charcoal contrast, soft lavender panels, clean white space, and
a confident geometric brand mark. Keep this identity restrained and
intentional.

> **v2.1 --- adapted to the latest UI frames (Select Request Type
> gallery + Run tracker).** Changes vs v2.0 are marked `[v2.1]`. Earlier
> sections unchanged unless marked.

------------------------------------------------------------------------

## 1. Color System

The palette is an **OSY purple scale (100--900)** plus a **charcoal and
soft-neutral scale** for supporting surfaces.

### 1.1 Primary --- OSY Purple Scale

  -----------------------------------------------------------------------
  Token                   Hex                     Usage
  ----------------------- ----------------------- -----------------------
  `--purple-100`          `#ECE0FF`               Lightest tints,
                                                  disabled fills, soft
                                                  backgrounds

  `--purple-200`          `#D8C2FF`               Hover tints, subtle
                                                  accent fills

  `--purple-300`          `#B78AFF`               Light accent, secondary
                                                  highlights

  `--purple-400`          `#8B4BEA`               Mid accent

  `--purple-500`          `#6316DB`               **PRIMARY accent** ---
                                                  buttons, active states,
                                                  links

  `--purple-600`          `#5010B8`               Hover on primary

  `--purple-700`          `#3F0D91`               Active/pressed on
                                                  primary

  `--purple-800`          `#2C0A68`               Deep emphasis

  `--purple-900`          `#1A073D`               Darkest purple,
                                                  near-navy
  -----------------------------------------------------------------------

> **Primary accent = `--purple-500` (`#6316DB`).** This is OSY's
> signature purple, used for brand actions and active states. Hover
> darkens to 600, pressed to 700.

### 1.2 Neutral --- Charcoal & Neutral Scale

Neutral tones are anchored by OSY charcoal `#171F25`, soft lavender
`#ECE0FF`, and base `#F5F5F5`.

  Token             Hex         Usage
  ----------------- ----------- -----------------------------------
  `--neutral-50`    `#F5F5F5`   App canvas background
  `--neutral-100`   `#F0EAF8`   Subtle fills, skeleton base
  `--neutral-200`   `#E3D9F0`   Borders, dividers
  `--neutral-300`   `#C8BBD8`   Strong borders, disabled outlines
  `--neutral-400`   `#9A8EAA`   Placeholder text, muted icons
  `--neutral-500`   `#655B70`   Secondary text
  `--neutral-600`   `#45404C`   Body strong
  `--neutral-700`   `#292832`   Headings (alt)
  `--neutral-800`   `#171F25`   Primary text
  `--neutral-900`   `#10171C`   Darkest text, max contrast

**OSY Brand Anchors**

  -----------------------------------------------------------------------
  Brand role              Hex                     Usage
  ----------------------- ----------------------- -----------------------
  **Primary**             `#6316DB`               Brand actions, active
                                                  states, key highlights

  **Secondary**           `#171F25`               Dark surfaces, strong
                                                  text, high-contrast
                                                  panels

  **Accent**              `#ECE0FF`               Soft lavender surfaces,
                                                  subtle highlights

  **Base**                `#F5F5F5`               App canvas and neutral
                                                  backgrounds
  -----------------------------------------------------------------------

These four values are the fixed OSY identity anchors. Supporting shades
may be used for states and depth, but must remain visually derived from
this palette.

### 1.3 Semantic Roles

  ----------------------------------------------------------------------
  Token                      Hex                   Usage
  -------------------------- --------------------- ---------------------
  `--color-text-primary`     `#171F25`             Headings, primary
                                                   body

  `--color-text-secondary`   `#655B70`             Descriptions,
                                                   metadata

  `--color-text-tertiary`    `#9A8EAA`             Placeholders,
                                                   captions, disabled

  `--color-surface`          `#FFFFFF`             Cards, panels, inputs

  `--color-background`       `#F5F5F5`             App canvas

  `--color-border`           `#E3D9F0`             Default borders

  `--color-border-strong`    `#C8BBD8`             Emphasized borders

  `--color-accent`           `#6316DB`             Primary accent (=
                                                   purple-500)

  `--color-accent-hover`     `#5010B8`             Primary hover (=
                                                   purple-600)

  `--color-accent-active`    `#3F0D91`             Primary pressed (=
                                                   purple-700)

  `--color-accent-soft`      `#ECE0FF`             Soft accent fill (=
                                                   purple-100)
  ----------------------------------------------------------------------

### 1.4 Status Colors

Sampled from the button Success/Error states and input validation.

  ----------------------------------------------------------------------
  Token                    Hex                    Usage
  ------------------------ ---------------------- ----------------------
  `--color-success`        `#05CD99`              Success
                                                  buttons/borders,
                                                  approved

  `--color-success-soft`   `#DCFCE7`              Success backgrounds

  `--color-success-text`   `#05A87C`              Success caption text

  `--color-error`          `#EE1D1D`              Error buttons/borders,
                                                  rejected

  `--color-error-soft`     `#FDE2E2`              Error backgrounds

  `--color-error-text`     `#E31A1A`              Error caption text

  `--color-warning`        `#F97316`              Escalated, pending,
                                                  attention (orange ---
                                                  no yellow in palette)

  `--color-warning-soft`   `#FFEDD5`              Warning backgrounds
  ----------------------------------------------------------------------

> **Map to workflow domains:** Approved → `--color-success`, Rejected →
> `--color-error`, Escalated/Pending → `--color-warning`, Active
> processing → `--color-accent`.

### 1.5 `[v2.1]` Destructive / Logout

The frames show the **Logout** action with a soft red fill and coral
text (distinct from `error`, used for a calm sign-out affordance, not a
hard error). Add a dedicated soft-destructive token:

  -----------------------------------------------------------------------
  Token                   Hex                     Usage
  ----------------------- ----------------------- -----------------------
  `--color-logout-soft`   `#FDECEC`               Logout button
                                                  background (soft coral
                                                  fill)

  `--color-logout-text`   `#F26464`               Logout label + icon
                                                  (muted coral, softer
                                                  than `--color-error`)
  -----------------------------------------------------------------------

> Logout is the only place this coral pairing appears. Everywhere else,
> destructive = `--color-error`. Keep them distinct: Logout is
> "soft/calm," real errors are "hard/red."

### 1.6 `[v2.1]` Priority text colors

The Details panel renders **Priority** as inline colored text. Map:

  Priority   Color
  ---------- -----------------------------
  Low        `--color-success` (#05CD99)
  Medium     `--color-warning` (#F97316)
  High       `--color-error` (#EE1D1D)

------------------------------------------------------------------------

## 2. Gradients

Ten brand gradients + monochrome set from the Gradients sheet. Use
sparingly --- section banners, hero cards, the typography-style headers,
accent backgrounds. Default angle **135°** (top-left → bottom-right).

  ------------------------------------------------------------------------------------------
  Name             Stops                 CSS
  ---------------- --------------------- ---------------------------------------------------
  Gradient 1       `#8B4BEA → #6316DB`   `linear-gradient(135deg,#8B4BEA,#6316DB)`
  (primary brand)                        

  Gradient 2       `#D8C2FF → #5010B8`   `linear-gradient(135deg,#D8C2FF,#5010B8)`
  (pink-purple)                          

  Gradient 3       `#8B4BEA → #ECE0FF`   `linear-gradient(135deg,#8B4BEA,#ECE0FF)`
  (magenta-cyan)                         

  Gradient 4       `#6316DB → #8B4BEA`   `linear-gradient(135deg,#6316DB,#8B4BEA)`
  (purple)                               

  Gradient 5       `#5010B8 → #D8C2FF`   `linear-gradient(135deg,#5010B8,#D8C2FF)`
  (teal-magenta)                         

  Gradient 6       #3F0D91 → #8B4BEA →   linear-gradient(135deg,#3F0D91,#8B4BEA,#ECE0FF)\`
  (purple \`       #ECE0FF\`\`           
  triple)                                

  Gradient 7       #6316DB → #D8C2FF\`\` linear-gradient(135deg,#6316DB,#D8C2FF)\`
  (lavender) \`                          

  Gradient 8       #ECE0FF → #F5F5F5\`\` linear-gradient(135deg,#ECE0FF,#F5F5F5)\`
  (soft) \`                              

  Gradient 9       #171F25 → #45404C\`\` linear-gradient(135deg,#171F25,#45404C)\`
  (charcoal) \`                          

  Gradient 10      `#B3FFAB → #12FFF7`   `linear-gradient(135deg,#F5F5F5,#ECE0FF)`
  (green-cyan)                           
  ------------------------------------------------------------------------------------------

**Primary brand gradient** (use for banners/hero):
`--gradient-brand: linear-gradient(135deg, #8B4BEA 0%, #6316DB 100%)`.

### 2.1 `[v2.1]` Canvas ambient gradient

The app canvas is **not flat** --- there's a faint lavender/purple bleed at
the top fading to `--neutral-50`. The shipped treatment is a static,
non-interactive `AmbientBackground` layer behind all light screens:

``` css
--gradient-canvas: linear-gradient(180deg, #ECE0FF 0%, #F5F5F5 38%, #F5F5F5 100%);
```

Two very large, very faint radials sit above that base: a purple haze in the
top-right at **4.5% opacity** and a white lift in the top-left at **55%**.
Both fade to transparent before 60% of the screen, so most of the canvas stays
neutral. No animation, blur, blobs, or per-card gradients.

In React Native this is built with `experimental_backgroundImage`
(no extra dependency). The Device Playground keeps its own dark charcoal
surface and does not use this layer. Solid `--neutral-50` remains an
acceptable fallback. Keep it quiet --- it must never compete with content.

Monochrome gradients (overlays, masks): white→black `#F6F6F6→#000000`,
and variants in the sheet.

------------------------------------------------------------------------

## 3. Typography

**Font:** `Gabarito` (Google Fonts). Use weights 400, 500, 600, 700.
Keep every existing type size, line-height, weight role, and
letter-spacing value unchanged.

``` css
font-family: 'Gabarito', system-ui, -apple-system, sans-serif;
```

**Arabic:** Gabarito has no Arabic glyphs, so Arabic uses `IBM Plex Sans
Arabic` at the same weights and sizes. Remove letter-spacing, because it
breaks joined letters, and use line-heights 20% taller for the marks.
`createArabicTypography()` in `src/common/lib/tokens.ts` applies this.

### 3.1 Display Scale (letter-spacing −2% / `-0.02em`, weight 700)

  -------------------------------------------------------------------------------------
  Name       Size       Line-height   CSS
  ---------- ---------- ------------- -------------------------------------------------
  Display XL 64px       72px          `text-[64px] leading-[72px] tracking-[-0.02em]`

  Display L  50px       64px          `text-[50px] leading-[64px] tracking-[-0.02em]`

  Display M  42px       56px          `text-[42px] leading-[56px] tracking-[-0.02em]`

  Display S  34px       42px          `text-[34px] leading-[42px] tracking-[-0.02em]`

  Display XS 24px       32px          `text-[24px] leading-[32px] tracking-[-0.02em]`
  -------------------------------------------------------------------------------------

### 3.2 UI Text Scale

  ------------------------------------------------------------------------
  Role        Size        Line-height   Weight      Usage
  ----------- ----------- ------------- ----------- ----------------------
  Heading L   24px        32px          700         Page titles
                                                    (e.g. "Select Request
                                                    Type")

  Heading M   20px        28px          600         Section titles

  Heading S   16px        24px          600         Card titles

  Body        14px        22px          400         Default body

  Body medium 14px        22px          500         Buttons, nav labels

  Label       13px        18px          400         Metadata, captions

  Overline    11px        16px          600         Section labels ---
                                                    uppercase,
                                                    `tracking-[0.08em]`,
                                                    tertiary color
  ------------------------------------------------------------------------

### 3.3 Rules

-   Headings: `--color-text-primary`, 600--700.
-   Body/descriptions: `--color-text-secondary`.
-   Overlines: uppercase, 11px, 600, letter-spacing `0.08em`, color
    `--color-text-tertiary`.
-   Use OSY charcoal `#171F25` for the strongest text and dark surfaces;
    avoid introducing unrelated black tones.

------------------------------------------------------------------------

## 4. Border Radius

The system is **strongly rounded**: pills for interactive elements,
large radii for containers.

  -----------------------------------------------------------------------
  Token                   Value                   Usage
  ----------------------- ----------------------- -----------------------
  `--radius-sm`           8px                     Small chips, inner
                                                  elements, checkboxes

  `--radius-md`           12px                    Inputs, list items

  `--radius-lg`           16px                    Cards, panels, color
                                                  swatches

  `--radius-xl`           20px                    Large containers,
                                                  modals (rounded
                                                  variant)

  `--radius-2xl`          24px                    App shell, big panels,
                                                  section banners

  `--radius-full`         9999px                  **Buttons, toggles,
                                                  avatars, sliders,
                                                  pills, nav items**
  -----------------------------------------------------------------------

**Modal radius variants:** Rounded = `--radius-xl` (20px), Semi-Rounded
= `--radius-lg` (16px), Squared = `--radius-md` (12px). Default to
**Rounded**.

> **Defining rule:** every button is `--radius-full` (pill). Cards are
> 16px. The shell and banners are 24px. `[v2.1]` Sidebar nav items and
> filter pills are also `--radius-full`.

------------------------------------------------------------------------

## 5. Shadows & Effects

From the Effects / Drop Shadow sheet --- soft, diffuse, charcoal-tinted.
Never harsh black.

  --------------------------------------------------------------------------
  Token               Value                               Usage
  ------------------- ----------------------------------- ------------------
  `--shadow-xs`       `0 1px 2px rgba(23,31,37,0.04)`     Subtle lift
                                                          (chips, inputs)

  `--shadow-sm`       `0 2px 8px rgba(23,31,37,0.05)`     Cards at rest

  `--shadow-md`       `0 4px 16px rgba(23,31,37,0.07)`    Raised cards,
                                                          dropdowns, modals

  `--shadow-lg`       `0 12px 32px rgba(23,31,37,0.10)`   Floating panels,
                                                          large modals, app
                                                          shell

  `--shadow-soft`     `0 8px 24px rgba(23,31,37,0.08)`    Signature card
                                                          shadow

  `--shadow-accent`   `0 8px 24px rgba(99,22,219,0.30)`   Primary button
                                                          glow
  --------------------------------------------------------------------------

> The signature card look is `--shadow-soft` with a subtle accent glow
> under primary buttons via `--shadow-accent`.

------------------------------------------------------------------------

## 6. Spacing Scale

Base unit **4px**.

  Token         Value      Token          Value
  ------------- ------- -- -------------- -------
  `--space-1`   4px        `--space-6`    24px
  `--space-2`   8px        `--space-8`    32px
  `--space-3`   12px       `--space-10`   40px
  `--space-4`   16px       `--space-12`   48px
  `--space-5`   20px       `--space-16`   64px

**Observed:** card padding 20--24px · card gap 16px · nav item padding
10--12px · section rhythm 32px · panel gap 24px.

------------------------------------------------------------------------

## 7. Buttons

**4 variants × 4 sizes × full state matrix.** All buttons are
pill-shaped (`--radius-full`).

### 7.1 Variants

  ------------------------------------------------------------------------
  Variant         Default fill       Text               Border
  --------------- ------------------ ------------------ ------------------
  **Primary**     `--color-accent`   white              none
                  (#6316DB)                             

  **Secondary**   transparent        `--color-accent`   1.5px
                                                        `--color-accent`

  **Subtle**      transparent        `--color-accent`   1px
                                                        `--color-border`

  **Text**        none               `--color-accent`   none
  ------------------------------------------------------------------------

### 7.2 Sizes

  Size     Height             Padding-X   Font         Icon
  -------- ------------------ ----------- ------------ ----------
  Large    48px               24px        16px / 600   20px
  Medium   40px               20px        14px / 600   18px
  Small    32px               16px        13px / 600   16px
  Icon     square (=height)   ---         ---          centered

> `[v3]` Large buttons are **52px** with no accent glow. A **Tonal**
> variant (`--color-background-element` fill, `--color-accent-active`
> text, `--purple-100` when pressed) is the second way forward next to a
> primary, as on Welcome and Sign in.

### 7.3 State Matrix (applies to every variant)

  --------------------------------------------------------------------------------------
  State            Primary                            Secondary         Subtle / Text
  ---------------- ---------------------------------- ----------------- ----------------
  Default          accent fill                        accent outline    accent text

  Hover            `--color-accent-hover` (#5010B8)   fill tints        bg
                                                      `--purple-100`,   `--purple-100`
                                                      border darkens    

  Focus            accent + ring                      outline + same    subtle ring
                   `0 0 0 4px rgba(99,22,219,0.20)`   ring              

  Active/Pressed   `--color-accent-active` (#3F0D91)  fill              bg
                                                      `--purple-200`    `--purple-200`

  Loading          accent fill + white spinner; (Text spinner in accent spinner /
                   variant "Loading...")                                "Loading..."

  Disabled         `--purple-300` @ 60%, no pointer   faded outline,    tertiary text
                                                      tertiary text     

  Success          `--color-success` fill + white ✓   success outline + success text + ✓
                                                      ✓                 

  Error            `--color-error` fill + white ✕     error outline + ✕ error text + ✕
  --------------------------------------------------------------------------------------

### 7.4 Icon placement

-   **Right Icon:** chevron/arrow after label.
-   **Left Icon:** icon before label.
-   **Icon-only:** single centered icon, square pill or circle.

### 7.5 Transitions

All button state changes: `transition: all 160ms ease-out`. Hover may
add a 1px lift + `--shadow-accent` for primary.

------------------------------------------------------------------------

## 8. Inputs

From Inputs (Large/Small/TextArea/Credit Card) + the notched
floating-label pattern.

### 8.1 Sizes

-   **Large:** height 48px, padding `14px 16px`, font 14--15px.
-   **Small:** height 40px, padding `10px 14px`, font 14px.
-   **TextArea:** min-height \~96px, resize handle bottom-right.

### 8.2 Structure

-   Surface white, border 1px `--color-border`, `--radius-md` (12px).
-   Optional **leading icon** in tertiary color.
-   Optional **trailing clear-X** (appears in active/filled).
-   **Floating label** (notched into the top border) for labeled fields.
-   Caption text below in 13px secondary (or semantic color for
    success/error).

> `[v3]` Form fields replace the floating label with a **label above**
> (14px / 600), a **52px** field, 16px text, a `--color-background`
> fill and a 1px `borderField` edge (`--neutral-400`, 3:1 on white).
> Focus turns the field white with a 1.5px accent border and a 4px
> `focusRing`. Error uses a 1.5px `--color-error-text` border; a value
> to check (read by OCR) uses a 1.5px `--color-warning` border. Both put
> an icon and a 13px message under the field.

> `[v2.1]` **Search input** in the frames is a wide pill-ish field with
> a leading home/search glyph and a trailing **✕** clear. Confirmed as
> the standard search pattern; radius reads as
> `--radius-md`→`--radius-lg`. Background slightly tinted
> (`--neutral-50`) rather than pure white when at rest.

### 8.3 State Matrix

  ----------------------------------------------------------------------------
  State          Border                             Label/Icon    Caption
  -------------- ---------------------------------- ------------- ------------
  Default        `--color-border`                   placeholder   ---
                                                    tertiary      

  Active/Focus   `--color-accent` + ring            accent        ---
                 `0 0 0 3px rgba(99,22,219,0.12)`                 

  Typing         accent border, caret visible       floating      ---
                                                    label accent  

  Filled         `--color-border-strong`, value in  trailing X    ---
                 primary                            visible       

  Success        `--color-success` border           success       success
                                                                  caption text

  Error          `--color-error` border             error         error
                                                                  caption text

  Disabled       `--color-border` @ 50%, bg         tertiary, no  ---
                 `--neutral-50`                     caret         
  ----------------------------------------------------------------------------

### 8.4 Specialized inputs

-   **Search:** leading glyph, trailing X when filled.
-   **Credit Card:** leading card glyph, formatted number, trailing
    brand mark.

------------------------------------------------------------------------

## 9. Dropdowns & Accordions

### 9.1 Dropdown (select) --- Indicators

  ---------------------------------------------------------------------
  State                              Spec
  ---------------------------------- ----------------------------------
  Default                            white fill, `--color-border`,
                                     chevron-down tertiary,
                                     `--radius-md`

  Active                             border `--color-border-strong`,
                                     chevron darkens

  Focus                              border `--color-accent` + accent
                                     ring

  Disabled                           bg `--neutral-50`, text tertiary,
                                     chevron faded

  Skeleton                           `--neutral-100` fill, no content,
                                     shimmer
  ---------------------------------------------------------------------

Chevron rotates 180° when open. Menu panel: white, `--radius-md`,
`--shadow-md`, items hover `--purple-100`.

### 9.2 Accordion

  ---------------------------------------------------------------------
  State                              Spec
  ---------------------------------- ----------------------------------
  Default (collapsed)                header only, `--neutral-50` fill,
                                     chevron-down, `--radius-md`

  Active (expanded)                  border `--color-accent`, header
                                     text accent, chevron-up, body in
                                     secondary

  Disabled                           faded, no interaction
  ---------------------------------------------------------------------

Expand/collapse animates height + chevron rotation, 200ms ease-out.

------------------------------------------------------------------------

## 10. Secondary Inputs

Checkboxes, radios, toggles, sliders. Each has
Primary/Secondary/Subtle/Icon styles where shown, with the full state
matrix.

### 10.1 Rounded Checkboxes

4 styles: Primary (filled accent square + white check), Secondary
(accent outline circle + accent check), Subtle (light outline), Icon
(minimal check glyph). States: checked, hover (`--purple-700`), focus
(+ring), active, unchecked (`--purple-100`/outline), disabled
(`--purple-300`).

### 10.2 Radios

Primary (accent ring, filled dot) + Secondary (grey outline). Full
states. Fully circular.

### 10.3 Toggles

Pill track. ON = accent fill + white knob right; OFF = `--neutral-200`
track, knob left. States: default, hover (`--purple-700`), focus
(+ring), active, disabled (`--purple-300`). Knob: white, `--shadow-xs`,
150ms slide.

### 10.4 Sliders

Track filled = gradient `--purple-300 → --purple-500`; remainder
`--neutral-200`. Thumb: white + accent border + `--shadow-sm`. States:
default, hover (thumb grows), focus (ring), active, sliding (value
bubble in accent pill), disabled.

------------------------------------------------------------------------

## 11. Cards

### 11.1 Standard Card

-   White, `--radius-lg` (16px), `--shadow-soft`, padding 24px.
-   Title (Heading S) → description (14px secondary) → action row.
-   Action row may hold a Primary pill (with `--shadow-accent` glow) +
    Secondary pill.

### 11.2 Media Card

-   Image/illustration block at top, then title + description, padding
    20--24px.
-   Hover: lift to `--shadow-lg`, optional faint accent border.

### 11.3 `[v2.1]` Request Template Card (from the gallery frame)

The Select Request Type gallery is the canonical card grid. Spec: -
White surface, `--radius-lg`, subtle border `--color-border`,
`--shadow-sm` at rest. - **Header row:** title (Heading S, primary) on
the left, a `⋯` overflow menu icon (tertiary) top-right. - **Meta row:**
a small calendar glyph + duration label (e.g. "\~3--5 days") in 13px
secondary. - **Body:** 3-line description (14px secondary), clamped with
ellipsis. - **Hover:** lift to `--shadow-md` + faint accent border. -
**Grid:** 3 columns ≥1280px, 16--24px gap, equal-height cards.

### 11.4 `[v2.1]` "New Request" tile (add-card)

A dashed-look CTA tile matching card dimensions: centered `＋` glyph
(accent or primary text) above a "New Request" label (Heading S).
Slightly tinted `--neutral-50` fill, `--radius-lg`. Hover: accent
border + `--purple-100` tint.

### 11.5 Workflow-status card

Reuse Standard Card + a status pill (top-right) using status colors:
Approved=success, Rejected=error, Escalated=warning, In-progress=accent.
Footer: department tag chip + avatar stack + timestamp.

------------------------------------------------------------------------

## 12. Modals

Three radius variants (Rounded 20px / Semi-Rounded 16px / Squared 12px)
× three sizes (Large/Medium/Small). Default: Rounded, Medium.

-   Surface white, chosen radius, `--shadow-lg`.
-   Close ✕ top-right in a soft circular button (`--purple-100` bg).
-   Centered title, description (14px secondary, centered).
-   Primary pill action + Text button below.
-   Sizes: Large \~520px/40px · Medium \~440px/32px · Small
    \~360px/24px.
-   Backdrop: `rgba(23,31,37,0.25)` + `backdrop-filter: blur(8px)`.
    Animate fade + scale 0.96→1, 200ms.

------------------------------------------------------------------------

## 13. Iconography

-   **Style:** line/outline, \~1.5--2px stroke, rounded caps/joins.
-   **Sizes:** 16px inline, 20px nav/buttons, 24px feature.
-   **Color:** inherits text --- secondary by default, accent when
    active, semantic for status.
-   **Library:** `lucide-react`. Keep stroke weight consistent; don't
    mix filled and outline.

------------------------------------------------------------------------

## 14. Layout Structure

3-zone dashboard inside a floating rounded shell on the canvas.

    ┌──────────────────────────────────────────────────────────┐
    │ App shell (radius-2xl, shadow-lg, floats on canvas)      │
    │ ┌────────┬─────────────────────────────┬───────────────┐ │
    │ │SIDEBAR │  MAIN CONTENT (fluid)        │  RIGHT RAIL   │ │
    │ │ ~240px │                             │  ~320px       │ │
    │ └────────┴─────────────────────────────┴───────────────┘ │
    └──────────────────────────────────────────────────────────┘

  Zone            Width   Notes
  --------------- ------- ------------------------------------------------
  Sidebar         240px   Collapsible (toggle icon top-right of sidebar)
  Main            fluid   Primary work area
  Right rail      320px   Hidden \< 1024px
  Top bar         64px    Search + actions (page-dependent)
  Shell padding   24px    Canvas shows through

**Responsive:** ≥1280px 3-col · 768--1279px 2-col (rail collapses) ·
\<768px single col, sidebar drawer.

### 14.1 `[v2.1]` Sidebar (from the frames)

-   Background near-white (`--neutral-50`/white), the whole shell
    floating with `--shadow-lg` on the ambient canvas.
-   **Top:** brand logo (purple "OSY brand" mark) + a sidebar-collapse
    toggle icon (top-right of the sidebar).
-   **Nav items:** leading outline icon (20px) + label (Body medium,
    14px/500).
    -   **Active:** `--color-accent-soft` (`--purple-100`) pill
        background, `--color-accent` icon + label, `--radius-full`.
    -   **Hover (inactive):** `--purple-100` @ \~50% tint.
    -   **Inactive:** transparent, `--color-text-secondary` label,
        secondary icon.
-   **Bottom user block:** avatar + "Welcome back 👋" overline + name
    (Body medium), with a `›` chevron. Sits pinned to the bottom.
-   **Logout button:** full-width pill, `--color-logout-soft`
    background, `--color-logout-text` label + leading icon. Sits below
    the user block. (See §1.5.)

### 14.2 `[v2.1]` Filter pills row

Top-right of a list/gallery page: a row of pill filters. - **Active:**
`--color-accent` solid fill, white label, `--radius-full`. -
**Inactive:** `--neutral-200`/`--purple-100` soft fill,
`--color-text-secondary` label, `--radius-full`. - Small horizontal gap
(8px); pills are Small-button height (\~32px).

------------------------------------------------------------------------

## 15. `[v2.1]` Workflow Tracker (Timeline) --- NEW COMPONENT

The run-detail frame introduces a **vertical step tracker** that is core
to FlowWise. This is the canonical run-progress component.

### 15.1 Structure

A vertical list of steps connected by a vertical line. Each step: -
**Node (left):** a circular marker on the connecting line. - **Content
(right):** step title (Heading S / Body medium, primary), sub-line
description (14px secondary), and a right-aligned timestamp or status
label (13px tertiary).

### 15.2 Step states

  ------------------------------------------------------------------------------
  State          Node               Title                     Connector above
  -------------- ------------------ ------------------------- ------------------
  **Done**       filled             primary, 600              solid
                 `--color-accent`                             `--color-accent`
                 circle + white ✓                             

  **Active /     `--color-accent`   primary, 600              solid
  current**      ring (outline)                               `--color-accent`
                 circle, hollow                               (gradient fade
                 center, optional                             into upcoming)
                 pulse                                        

  **Waiting**    same outline node  primary; right label      ---
  (sub-state of                     "Waiting..." in tertiary  
  active)                                                     

  **Upcoming**   small              `--color-text-tertiary`   `--neutral-200`
                 `--neutral-300`                              
                 dot                                          

  **Terminal     small flag glyph,  tertiary                  `--neutral-200`
  flag** (end)   tertiary                                     
  ------------------------------------------------------------------------------

### 15.3 Connector line

-   Between completed/active steps: `--color-accent`, \~2px, with a
    subtle vertical **gradient** (`--purple-500 → --purple-300`)
    approaching the active node.
-   Between upcoming steps: `--neutral-200`, \~2px.

### 15.4 Layout

-   Lives in the main content area (run detail), to the right of a
    "Current Status + Details" column.
-   Each step row: node column \~32px, then content. Row vertical rhythm
    \~24px.
-   Timestamps right-aligned in the row (e.g. "Oct 24, 09:00").

### 15.5 Companion: "Current Status" panel

Left of the tracker (from the frame): - Card, white, `--radius-lg`,
`--shadow-soft`. - "Current Status" overline → status pill ("In
progress" = `--purple-100` fill, accent text + spinner glyph). - Divider
→ "Estimated resolution" overline → value (Heading S, primary).

### 15.6 Companion: "Details" panel

Below Current Status: - Card, white, `--radius-lg`. - "Details" title
(Heading S). - Key/value rows: label (secondary, left) + value (primary,
right). Priority value colored per §1.6. - "Description" block:
overline + multi-line body (14px secondary).

> **FlowWise mapping:** this tracker is the per-run progress view. For
> the multi-agent collaboration story, the same step model can carry
> department/agent labels and decisions (approve/reject/escalate) per
> step.

------------------------------------------------------------------------

## 16. `[v2.1]` Status Pills

Small pill labels for run/step status.

  ----------------------------------------------------------------------------
  Status       Fill                     Text                      Glyph
  ------------ ------------------------ ------------------------- ------------
  In progress  `--purple-100`           `--color-accent`          spinner
                                                                  (rotating)

  Approved /   `--color-success-soft`   `--color-success-text`    ✓
  Done                                                            

  Rejected     `--color-error-soft`     `--color-error-text`      ✕

  Escalated /  `--color-warning-soft`   `--color-warning`         ↑ / clock
  Pending                                                         

  Waiting      transparent /            `--color-text-tertiary`   ---
               `--neutral-100`                                    
  ----------------------------------------------------------------------------

Pill: `--radius-full`, padding `4px 10px`, 13px/600, leading glyph 14px.

------------------------------------------------------------------------

## 17. Motion & Interaction

-   Transitions 150--200ms ease-out (color, shadow, transform).
-   Buttons: 160ms; hover lift 1px + accent glow for primary.
-   Toggles/checkboxes: 150ms slide/fill.
-   Accordions/dropdowns: 200ms height + chevron rotation.
-   Modals: 200ms fade + scale.
-   Skeletons: 1.5s shimmer loop on `--neutral-100`.
-   `[v2.1]` Tracker active node: subtle pulse on the outline ring. "In
    progress" pill spinner rotates continuously.
-   Nav active: instant fill, no bounce.

------------------------------------------------------------------------

## 18. Tailwind Config Snippet

``` ts
import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        purple: {
          100: "#ECE0FF", 200: "#D8C2FF", 300: "#B78AFF",
          400: "#8B4BEA", 500: "#6316DB", 600: "#5010B8",
          700: "#3F0D91", 800: "#2C0A68", 900: "#1A073D",
        },
        neutral: {
          50: "#F5F5F5", 100: "#F0EAF8", 200: "#E3D9F0",
          300: "#C8BBD8", 400: "#9A8EAA", 500: "#655B70",
          600: "#45404C", 700: "#292832", 800: "#171F25", 900: "#10171C",
        },
        accent: {
          DEFAULT: "#6316DB", hover: "#5010B8", active: "#3F0D91", soft: "#ECE0FF",
        },
        text: { primary: "#171F25", secondary: "#655B70", tertiary: "#9A8EAA" },
        background: "#F5F5F5",
        border: { DEFAULT: "#E3D9F0", strong: "#C8BBD8" },
        success: { DEFAULT: "#05CD99", soft: "#DCFCE7", text: "#05A87C" },
        error: { DEFAULT: "#EE1D1D", soft: "#FDE2E2", text: "#E31A1A" },
        warning: { DEFAULT: "#F97316", soft: "#FFEDD5" },
        logout: { soft: "#FDECEC", text: "#F26464" },   // [v2.1]
      },
      borderRadius: { sm: "8px", md: "12px", lg: "16px", xl: "20px", "2xl": "24px" },
      boxShadow: {
        xs: "0 1px 2px rgba(23,31,37,0.04)",
        sm: "0 2px 8px rgba(23,31,37,0.05)",
        md: "0 4px 16px rgba(23,31,37,0.07)",
        lg: "0 12px 32px rgba(23,31,37,0.10)",
        soft: "0 8px 24px rgba(23,31,37,0.08)",
        accent: "0 8px 24px rgba(99,22,219,0.30)",
      },
      fontFamily: { sans: ["'Gabarito'", "system-ui", "sans-serif"] },
      letterSpacing: { display: "-0.02em", overline: "0.08em" },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg,#8B4BEA 0%,#6316DB 100%)",
        "gradient-canvas": "linear-gradient(180deg,#ECE0FF 0%,#F5F5F5 38%)",  // [v2.1]
      },
    },
  },
};

export default config;
```

------------------------------------------------------------------------

## 19. Component Checklist (for build)

-   [ ] **Button** --- 4 variants × 4 sizes × {default, hover, focus,
    active, loading, disabled, success, error} + left/right/icon-only
-   [ ] **Input** --- Large + Small × {default, active, typing, filled,
    success, error, disabled} + floating label + search + clear-X
-   [ ] **TextArea** --- same states + resize handle
-   [ ] **Dropdown** --- {default, active, focus, disabled, skeleton} +
    open menu
-   [ ] **Accordion** --- {default, active, disabled} + animation
-   [ ] **Checkbox / Radio / Toggle / Slider** --- full state matrices
-   [ ] **Card** --- standard + media + `[v2.1]` request-template +
    `[v2.1]` new-request tile + workflow-status
-   [ ] **Modal** --- Rounded/Semi/Squared × Large/Medium/Small +
    backdrop
-   [ ] `[v2.1]` **Sidebar** --- nav items (active/hover/inactive) +
    user block + logout pill
-   [ ] `[v2.1]` **Filter pills row** --- active/inactive
-   [ ] `[v2.1]` **Workflow Tracker** --- step states
    (done/active/waiting/upcoming/terminal) + connector + Current Status
    & Details panels
-   [ ] `[v2.1]` **Status pills** ---
    in-progress/approved/rejected/escalated/waiting

------------------------------------------------------------------------

## 20. Do's and Don'ts

### Mobile glass surfaces

Appearance supports device, light, and dark preferences. The dark palette uses
OSY charcoal surfaces and lavender accents, with the same typography, radii,
spacing and pill controls. Use the shared theme hook for live appearance
changes; avoid placing theme-dependent text over a fixed light surface.

Home may use the shared `Card glass` variant. Keep the existing 16px card
radius, pill actions, Gabarito/Arabic typography, and OSY palette. Glass
tokens in `src/common/lib/tokens.ts` define translucent white/lavender
fills, a fine white edge, and soft charcoal shadows; feature screens must
not invent their own material colors.

Use guarded native Liquid Glass on supported iOS devices, frosted
translucent fills on Android/older iOS, and backdrop blur on web. Keep
text and controls above the decorative material with normal contrast.
Reduce Transparency and increased web contrast select solid white or
lavender surfaces. Do not animate native-glass opacity or add a glass
overlay above emergency actions.

**Do** - Use `#6316DB` (purple-500) as the one accent; darken to 600/700
for hover/active. - Make every button a pill; nav items and filters are
pills too. Cards 16px; shell/banners 24px. - Implement the full state
matrix for every interactive component. - Keep shadows soft and
charcoal-tinted; reserve the accent glow for primary buttons. - Use
OSY's charcoal, lavender, and neutral base consistently; avoid unrelated
cool-neutral or pure-black tones. - Use semantic colors consistently:
success green, error red, warning orange, accent purple. - `[v2.1]` Keep
Logout's soft-coral pairing distinct from hard `--color-error`. -
`[v2.1]` Keep the canvas ambient gradient subtle --- it must not compete
with content.

**Don't** - Don't introduce a second bright accent --- OSY purple is the
brand. - Don't use sharp corners or hard black borders/shadows. - Don't
ship a component with only its default state. - Don't overuse gradients
--- banners/hero/canvas only. - Don't crowd cards; respect 20--24px
padding.

------------------------------------------------------------------------

*DESIGN.md v2.1 --- FlowWise --- adapted to the latest UI frames (Select
Request Type gallery + Run tracker). Changes from v2.0 marked `[v2.1]`:
Logout/destructive token, priority colors, canvas ambient gradient,
request-template & new-request cards, sidebar spec, filter pills,
Workflow Tracker component, status pills.*
