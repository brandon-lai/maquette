# Maquette

[Live planner](https://maquette-delta-ruddy.vercel.app) ·
[GitHub repository](https://github.com/brandon-lai/maquette)

A website that turns a room into a true-to-scale 3D miniature, takes in furniture
you own or want to buy, and suggests where everything should go.

Maquette answers: **will my stuff fit, and where should it go?**

[Design direction and tokens](DESIGN.md).

## Run

```sh
nvm use 22 # or your preferred Node version manager
npm ci
npm run dev
```

No credentials are required. The opening room is explicitly labeled sample data.
Real rooms and edits save in this browser. View-only links contain a compressed
snapshot in the URL fragment; they work across devices without a database and
do not send the snapshot to the hosting server. Anyone with the link can read it.
Do not include a private address in a room you share.

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

## Architecture

Next.js App Router, TypeScript, React Three Fiber / Three.js, Base UI shadcn,
Tailwind v4, and optional Postgres via postgres.js. All geometry is in centimeters.
The polygon, openings, fixed features, furniture dimensions and placements are
the single source for the deterministic solver, SVG plan and PBR miniature.

Layouts are deterministic, not an LLM simulation. The solver places use zones
inside the polygon, protects door swings and windows, avoids collisions, and
checks a connected walkway with a conservative grid. Reasons describe scored
properties of the actual result. Manual edits may break constraints and then
show live warnings; suggestions never silently ignore them. Difficult rooms may
have fewer than three feasible distinct options, explicitly reported.

Floor plans are parsed locally: PDF text extraction, self-hosted English
Tesseract OCR and raster line/gap detection propose a measured boundary and openings. No external vision model receives your
upload. This is not a certified plan-recognition service: proposals are amber
and confirmation is mandatory. Supply a known wall measurement when printed
dimensions cannot be read. Printed dimensions are suggestions, not asserted truth.
Every proposed door/window must be reviewed; missing ones can be added manually.
Uploaded files stay in memory, not object storage. OCR assets and license
provenance live in `public/ocr/NOTICE.txt`.

Product import fetches public HTML on the server, extracts JSON-LD and metadata,
and asks for missing/ambiguous measurements. Source, price, currency, image and
color remain editable. It does not bypass retailer access controls or invent
measurements. Fetches are HTTPS-only, DNS-pinned, bounded and private-network
blocked at every redirect. Parametric furniture is **approximate shape, exact size**.

## Acceptance criteria (PRD P0 requirements)

These are the test plan, quoted from the PRD rather than success claims:

| Capability             | Requirement                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Draw a room            | Wall tool with snap-to-grid and angle snapping; type exact lengths; add doors (with swing direction), windows, closets, radiators, outlets; set ceiling height                                                     |
| Upload a floor plan    | Accept PDF, PNG, JPG. Detect walls, doors, windows. Read printed dimensions where present; otherwise ask the user to tap one wall and enter its length to set scale. Show low-confidence walls in amber for review |
| Confirm step           | All paths end on one screen: ink-style plan with every dimension editable. Nothing proceeds until the user confirms                                                                                                |
| Custom item            | Name, category, width × depth × height. Rendered as a parametric model for its category (sofa with arms, bed with headboard, desk) at exact size                                                                   |
| Paste a product link   | Extract name, dimensions, price, color, main image. If dimensions are missing or ambiguous, ask the user. Show source and allow edits                                                                              |
| Clearance zones        | Each category carries a use zone: chair pull-out, drawer and door opening, bed side access. Default values set from published interior design guidelines, editable per item                                        |
| Hard constraints       | Inside walls, no overlaps, door swings and windows clear, minimum walkway width, clearance zones respected                                                                                                         |
| Soft preferences       | Functional groupings (sofa faces TV, nightstands flank bed), natural light for desks, user brief items, visual balance                                                                                             |
| Three distinct options | Options must differ meaningfully (not the same layout nudged). Each has a one-line reason, such as "Bed on the long wall keeps a clear path to the closet"                                                         |
| Does-not-fit handling  | Set aside items that cannot fit, explain why, and state the largest size that would fit                                                                                                                            |
| Manual editing         | Drag, rotate in 15° steps, snap to walls and corners, live clearance warnings in amber                                                                                                                             |
| Desk miniature view    | Default view per Visual direction: room as a model on a drafting sheet, orbit and zoom, tilt-shift depth of field                                                                                                  |
| Build animation        | Walls rise from the paper, parts list card counts up, furniture settles in                                                                                                                                         |
| Top-down plan view     | Ink-style 2D plan with dimensions, toggled from the same scene                                                                                                                                                     |
| Materials and lighting | PBR materials for floors, walls, furniture; sun position from window orientation; time-of-day slider                                                                                                               |
| Share link             | View-only link that opens straight into the miniature                                                                                                                                                              |

The empirical gates (20 test rooms within 2% of tape measure, 50% suggestion
acceptance, 20% share rate) require real users and rooms. They are hypotheses,
not claims this build makes.

## Shipped scope and limitations

Draw/confirm, local floor-plan proposals, custom items, public-page product
metadata import, three-way deterministic layout search, manual plan/miniature
editing, use-zone warnings, build animation, PBR miniature, plan view, eye-level
view, sun control, snapshot sharing, dimensioned SVG/PNG export and a shopping
list. The starter furniture is generic sample data, not a licensed retailer
catalog. Prices appear only if imported or entered.

Automatic floor-plan recognition is a conservative rectangular boundary and gap
heuristic, not a semantic vision pipeline. Unusual/angled plans should be drawn
manually; gap classifications and English-only OCR always require review.
No vision credentials are needed. Real-time PBR is not photoreal path tracing.
No LiDAR/native app, photo reconstruction, mesh generation, collaboration, AR,
carry-through-door check, multi-room model, renovation, cabinetry or CAD/BIM export.

## Open questions: decisions shipped

| Question                 | Decision and reason                                                                                                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product name             | **Maquette**, the architect's physical miniature: the output is the identity.                                                                                                                                                                               |
| iOS app or App Clip      | **App Clip in Phase 2**, for one-session RoomPlan capture; a full app only if repeat scanning warrants installation. Not built in the web MVP.                                                                                                              |
| Business model           | **Free fit checks first; opt-in affiliate links later.** No payments, paywalls or invented pricing; validate trust before charging for renders.                                                                                                             |
| First catalog and source | **No scraped catalog.** Generic measured sample shapes plus user product links; pursue an authorized IKEA/affiliate feed before shipping branded inventory.                                                                                                 |
| Clearance guideline      | **2010 ADA 403.5.1** informs the 91.44cm main walkway; published RoomSketch3D furniture-spacing guidelines inform 60.96cm bed-side access, 91.44cm desk/chair pull-out and dresser access, 45.72cm seating access. Editable; not a claim of ADA compliance. |
| Dorm partnership         | **Not a launch dependency.** Ship a generic dorm template and validate the tool with students before promising residence-hall-specific dimensions.                                                                                                          |

Sources: [ADA accessible routes](https://www.access-board.gov/ada/chapter/ch04/),
[published furniture clearances](https://roomsketch3d.com/help/dimensions/clearance-around-furniture).

## Optional cloud storage

Supabase provisioning was attempted; it refused because the account already has
two active free projects. No existing project was paused, changed or reused.
The deployment is local-first, not a live cloud-room database. The optional
snapshot REST API is implemented and tested locally; enabling it does not add
accounts, automatic browser sync or replace fragment-based UI sharing.

Create capacity by upgrading (or deciding yourself to pause an unrelated project),
then create a dedicated database:

```sh
PW=$(openssl rand -base64 24 | tr -d '/+=')
supabase projects create maquette --org-id fyfeoigahrrlddchccbp \
  --db-password "$PW" --region us-west-1 -o json
# Wait for the new project to become ACTIVE_HEALTHY.
supabase link --project-ref '<new-ref>' --password "$PW"
supabase db push --password "$PW"
```

Get the **transaction pooler** connection string from Supabase; do not guess its
hostname:

```sh
TOK=$(security find-generic-password -s "Supabase CLI" -w)
curl -fsS -H "Authorization: Bearer $TOK" \
  'https://api.supabase.com/v1/projects/<new-ref>/config/database/pooler'
```

Use the returned port-6543 connection string, replacing its password placeholder
with `$PW`. Add that value as `DATABASE_URL` in Vercel, run the Supabase security
advisor, then trigger a **new commit**, not a no-op push:

```sh
vercel env add DATABASE_URL production
git commit --allow-empty -m "Enable optional cloud snapshots" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push origin main
```

The SQL migration enables RLS with no anonymous policies. Server-only postgres.js
uses `prepare: false`, lazily caches its connection, and cloud writes return 503
when `hasDatabase` is false. Cloud snapshots use hashed random capability tokens,
not public sequential identifiers. Run the Supabase security advisor before
enabling cloud storage for real users.

## Deployment

Production must come from the connected GitHub `main` branch. Never deploy a
working tree with `vercel deploy`. `.gitignore` and `.vercelignore` both exclude
local environment files. All dependencies are pinned in the lockfile.
Node 22 is the tested runtime. `NEXT_PUBLIC_APP_URL` is set to the assigned
production domain before the deployment-trigger push; `DATABASE_URL` is absent.

## Verification

18 unit tests and 15 real-Chrome browser tests passed, along with TypeScript,
ESLint and the production build. The optional cloud test passed separately against
local PostgreSQL; it is skipped when no database is configured. Rendering covered
1440/768/390px and 320px reflow, with real keyboard, accessibility-tree,
export, OCR/PDF, view-only sharing and WebGL-fallback checks. See
[DESIGN.md](DESIGN.md#verification) for measured contrast, motion exceptions and
the independent review. Physical accuracy and user-adoption benchmarks remain
unverified.

The same 15 browser tests passed against the live production domain. Its
1440/768/390px miniature renders and major states were inspected, with no measured
overflow or captured page errors. Public pages, icons, OCR/PDF workers and
metadata served successfully. Unconfigured cloud reads/writes returned 503,
private-network product import returned 422 and cross-origin import returned 403.
Vercel's Git deployment was matched to the pushed commit, not a local CLI upload.
The independent review's final verdict is **ship** after the drawing fix.

## Privacy

No accounts, telemetry, payment data or raw IP database columns. Browser storage
can be cleared from Settings. Sharing deliberately publishes a snapshot to people
holding its link. Imported product URLs are sent to the server and retailer;
retailer image previews may contact that retailer. See `/privacy` for user-facing
details. No private addresses, credentials or source PRD are committed.
