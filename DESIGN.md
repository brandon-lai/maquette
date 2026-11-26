---
version: alpha
name: Maquette / The architect's desk
description: A measured ink drawing becomes a warm, tangible miniature.
colors:
  primary: "oklch(0.49 0.105 63)"
  paper: "oklch(0.965 0.016 83)"
  surface: "oklch(0.985 0.008 83)"
  ink: "oklch(0.26 0.022 62)"
  muted-ink: "oklch(0.48 0.026 62)"
  rule: "oklch(0.76 0.034 78)"
  walnut: "oklch(0.40 0.055 60)"
  oak: "oklch(0.75 0.074 73)"
  amber-wash: "oklch(0.91 0.074 82)"
  error: "oklch(0.44 0.13 32)"
typography:
  title:
    fontFamily: Bodoni Moda
    fontSize: 40px
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: -0.025em
  room-title:
    fontFamily: Bodoni Moda
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.15
  body:
    fontFamily: Karla
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: Karla
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.4
  measurement:
    fontFamily: DM Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  small: 4px
  control: 6px
  sheet: 12px
spacing:
  tiny: 4px
  small: 8px
  related: 12px
  base: 16px
  group: 24px
  section: 40px
  generous: 64px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: 44px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: 44px
---

# Maquette

## Overview

**Mode:** operate, with an experience-mode miniature at its center. A renter sits
at a daylight kitchen table, measuring a new room before moving. The application
is light because of that scene, not because of its category.

**Mechanism:** exact centimeter geometry and furniture use zones produce
measurable arrangements, presented as a physical model.

The category rut is a generic CAD canvas with icon rails, or a polished but
dimensionless AI room photo. The audience's world includes listing printouts,
tape measures, cardboard moving boxes, masking-tape outlines, furniture delivery
slips, oak tables, and an architect's paper model: paper, metal, cardboard, wood.
The paper model best carries the mechanism. The PRD explicitly pins this world,
so it wins over a generic prohibition on warm paper and serif titles.

**Signature:** one room, two scales. The plan becomes a cutaway miniature; the
camera then moves inside the same geometry. Amber use zones connect the beautiful
model to the practical question: will this fit?

**Mirror test:** this is not a restyling gallery. The broad work surface, actual
dimension strings, movable true-size objects, and parts ledger belong to a
fit-first miniature planner, not a neighboring shopping or inspiration app.

## Colors

Restrained amber, under 5% of the interface. Cream paper, tinted ink, walnut and
oak are materials, not accents. Amber is selection, a warning, or the one primary
action. No black or white surfaces. Body and muted text must pass 4.5:1 against
paper; the darker amber primary carries light paper text.

The 3D material palette is a named token export in `lib/materials.ts`; procedural
wood and fabric textures derive from those colors. No remote texture dependency.
Browser selection, caret, native controls, and scrollbars inherit the same roles.
There is no dark scheme: inverting the drafting sheet would break the pinned
physical reference.

## Typography

Bodoni Moda is the room-name and title face: its precise verticals refer to a
printed architectural title block. Karla handles controls and short explanatory
copy without serif noise. DM Mono is an outlier for dimensions, scale, prices and
the parts ledger only, not a technical costume for headings.

The PRD requests small monospace caps. Measurements retain monospace; labels are
sentence case and untracked to preserve the craft floor and legibility.
Only regular and bold are loaded; `font-display: swap`, tabular figures and
`font-synthesis: none` apply. Mobile body and input text stay at 16px.

## Layout

A paper inventory tray sits beside the large desk surface. A title strip identifies
the room, the view switch sits over the model, and three layout strips sit beneath.
Do not turn the interface into a same-size card grid. The miniature gets most of
the screen. Maximum application width is 1520px; wider screens gain gutters.

At 768px the inventory becomes a disclosure beneath the scene. At 390px the room
view comes first, controls wrap deliberately, the comparison strips stack, and
the parts ledger reduces to a compact count. Dialogs are scrollable sheets with
16px breathing room and safe-area support.

## Elevation & Depth

Paper separates by a quiet rule or a two-layer walnut-tinted floating shadow:
`0 20px 50px oklch(0.26 0.022 62 / .12), 0 4px 12px oklch(0.26 0.022 62 / .08)`.
No glows, glass, or nested cards. The rendering uses real lighting, shadows and
rough PBR materials, rather than CSS pretending to be 3D.

## Shapes

6px controls, 12px sheets. The plan has crisp measured corners. Furniture carries
category-specific geometry: headboards, cushions, sofa arms and desk legs.

## Components

Base UI shadcn components own dialogs, tabs, sliders, tooltips and fields.
44px targets, instant focus outlines and tactile 1px press feedback apply
everywhere. Every mutable form validates before changing the model, with a
specific error and focus on the first invalid field. Shared rooms are view-only.

Motion has one authored moment: the physical build and camera dive. The build
takes about 1.2 seconds, deliberately longer than a UI transition because it
explains assembly. Press feedback uses 160ms and overlay entry uses 200ms with
cubic-bezier(.23,1,.32,1); overlay exit is 120ms. Dragging, dimension edits and keyboard navigation are immediate. Reduced
motion shows the assembled model and cuts directly between camera positions.

## Do's and Don'ts

Do show the same exact geometry in the plan and miniature. Do label sample data,
parametric shapes, uncertain imports and unavailable cloud storage.
Do make warnings measurable. Do let the model lead.

Do not invent retailer prices, accuracy claims, customer counts or AI results.
Do not hide the plan when WebGL is unavailable. Do not claim a render is
path-traced: it is real-time PBR. LiDAR, photo capture, generated meshes and paid
catalog integrations remain outside the MVP.

## Verification

The local release passed 18 unit tests, 15 real-Chrome browser tests, TypeScript,
ESLint and a production build. The optional cloud integration passed separately
against the dedicated local PostgreSQL database, including JSON object
round-trip, hashed capability storage, origin rejection, RLS and no raw-IP column.
The ordinary no-database browser run explicitly skips that integration.

Actual CDP viewports at 1440, 768 and 390px were rendered and inspected, with
320px reflow covered by the browser suite. Header and main content had no measured
overflow. All 15 mobile Tab stops had names and visible focus indicators; the
actual Chrome accessibility tree exposed the SVG furniture buttons and named
interactive controls. Dialog/menu Escape and exact-coordinate alternatives to
dragging were exercised. Native VoiceOver and a full WCAG conformance audit were
not verified.

Rendered contrasts against their actual backgrounds: body 14.08:1, muted text
5.92:1, primary label 6.21:1, input boundary 3.11:1 and focus indicator 6.21:1.
The plan, miniature, walk-in, setup, upload, drawing, editing, menus, sharing,
shopping, loading, errors, empty/long content, WebGL fallback, information routes,
downloaded PNG and social/apple artwork were captured and inspected.

Static sloplint reported only accepted gate 20 (Hallmark bookkeeping), with zero
other FAIL, REFLEX or WARN. The local motion scanner scored 59/100. Its background
and SVG-fill hover warnings are deliberate: frequent selection and measurement
actions are immediate, and only transform/opacity animate. Inventory disclosure
also appears immediately rather than adopting a 400ms panel recipe. The scanner
mislabels the Base UI dialog as hand-rolled and misses the shared tooltip CSS;
both use the owned 200ms entry/120ms exit tokens. Those timings intentionally
share one overlay grammar instead of the scanner's separate tooltip recipe.
The 1.2s assembly/camera moment is the one authored exception, with a still
reduced-motion path. No scanner fix service was used.

Design token lint has zero errors; six unreferenced material-role warnings are
intentional prose/3D palette entries rather than unused UI ramps. The PRD's
physical-measurement and user-acceptance benchmarks are not verified.

The first independent fresh-eyes review found one material issue: a fixed-height
drawing SVG letterboxed its coordinates inside a wider clickable sheet. Edge
clicks collapsed into collinear corners. The sheet now matches the viewBox's
aspect ratio, and out-of-grid clicks give explicit feedback rather than clamping.
A regression draws and confirms edge and center outlines at 1440 and 390px.
All eight before-confirmation/confirmation captures were inspected. The final
review verdict is pending.
