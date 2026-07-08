# OCTAVE Sales Dashboard — Next.js Conversion

## Goal

Convert the existing single-file `index.html` dashboard (dark, pink/turquoise-branded,
all vanilla JS + inline SVG charts, no framework) into a minimal Next.js project deployed
on Vercel, adding a non-technical-friendly "update data" flow:

```
Non-technical person → /upload page → drags Excel file → clicks "Update Dashboard"
   ↓ (parsed to JSON in the browser, reusing existing parsing logic)
   ↓ JSON POSTed to /api/update-data (server-side)
   ↓ API route commits data.json to GitHub via GitHub REST API (using a token, server-side only)
   ↓ Vercel's GitHub integration detects the push → auto-redeploys
   ↓ ~1 minute later, everyone visiting the dashboard sees the new data
```

No third-party data storage (no Vercel Blob, no S3, no external DB). The only place
the parsed data lives is inside our own GitHub repo, as a plain JSON file, which is the
same repo the site is already deployed from. This does NOT increase where company data
lives — it's already going to be inside the Vercel-hosted bundle either way.

**`index.html` will be added to this directory by the user before the build starts.**
Read it first — it is the source of truth for all styling, layout, CSS variables, and
the exact data-parsing logic (`loadExcelFile`). Do not redesign anything. Port it as-is.

---

## Why Next.js (not plain static HTML)

The upload flow needs a server-side API route to hold the GitHub token securely (it
can NOT live in browser-side code, or anyone opening dev tools could steal it and push
to the repo). Vercel is built by the creators of Next.js — API routes deploy on Vercel
with zero extra config, same ease as the plain HTML did before. Use the **App Router**
(`app/` directory) with a Route Handler for the API, not Pages Router.

---

## Tech stack

- Next.js (App Router, latest stable), TypeScript
- No UI framework/component library — port the existing hand-written CSS as-is
  (CSS variables, custom properties, all already in `index.html`'s `<style>` block)
- `xlsx` npm package (SheetJS) for server-safe parsing — same library already used
  client-side via CDN in `index.html`, just installed as a dependency instead
- `@octokit/rest` npm package for the GitHub commit step (cleaner than hand-rolling
  fetch calls to the GitHub API)
- No database. No Blob storage. No external services besides GitHub + Vercel.

---

## Project structure to create

```
/app
  /page.tsx              → the dashboard itself (ported from index.html body)
  /layout.tsx            → root layout, loads Lato font, sets <html data-theme="dark">
  /globals.css           → all CSS from index.html's <style> block, verbatim
  /upload
    /page.tsx            → the non-technical upload page (see below)
  /api
    /update-data
      /route.ts          → POST handler: receives JSON, commits to GitHub (see below)
    /data
      /route.ts           → GET handler: serves the current data.json (see "Data flow")
/data
  /data.json              → the committed dataset. This file is what gets overwritten
                            by the API route and redeployed. Ships with whatever
                            sample/mock data index.html currently uses, as the initial
                            commit.
/lib
  /parseExcel.ts          → the parsing logic, ported from loadExcelFile() in
                            index.html, made isomorphic (works both client-side on
                            the /upload page AND if we ever want server-side parsing).
                            Do not change the parsing rules — copy them exactly.
/.env.local               → local env vars (gitignored)
/CLAUDE.md                → this file
```

---

## Data shape (copy exactly from `index.html`'s `loadExcelFile()`)

The workbook has these sheets, each parsed into a specific JS shape. When you open
`index.html`, search for `function loadExcelFile` — that function is the exact spec.
Summary of what it does (verify against the real file, this is from memory of the
original build):

- **`Deals`** sheet → array of deal objects: `{ id, name, co, stage, source, value,
  close, won, lost }`. Also derives `dealStageCounts` (count per stage) and `dealTotal`.
- **`Deal Stages`** sheet → `stagesByQuarter`, keyed by quarter code, each value an
  object of stage → count, plus `total`.
- **`Business Metrics`** sheet → `bmByQuarter`, keyed by quarter code. Wide row with
  targets/currents for revenue, new clients, closed deals, billed amounts, budget,
  utilization, cost-per-X metrics, and MTD target fields.
- **`Lead Channels`** sheet → `channelsByQuarter`, keyed by quarter code, array of
  `{ name, accounts, contacted, replies, positive }` per channel.
- **`Projects`** sheet → project list, status values normalized via `normStatus()`
  (tolerates "Current"/"Active"/"Pending" and older label variants — check
  `normStatus` in the original file for the exact mapping).

The final shape produced by parsing all sheets is what gets JSON.stringify'd and
saved to `/data/data.json`, and is what the dashboard reads on load instead of
waiting for a manual file upload + localStorage.

---

## `/upload` page — requirements

- Single page, no auth complexity beyond a simple passcode gate (this is company data;
  a full login system is overkill for a once-a-week internal tool, but an unprotected
  public POST endpoint that can rewrite the repo is not okay either).
  - Store a passcode in an env var (`UPDATE_PASSCODE`). The `/upload` page asks for it
    before showing the drop zone. The API route also re-checks it server-side — never
    trust a client-side-only check.
- Drag-and-drop zone + a normal file input (`accept=".xlsx,.xls"`) for people who don't
  drag-and-drop.
- On file select: parse client-side with `lib/parseExcel.ts` (same logic as before, now
  shared rather than copy-pasted).
- Show a quick preview/sanity check before submitting (e.g. "Found 42 deals, 4 quarters
  of business metrics" — helps a non-technical person catch an obviously wrong file
  before it overwrites production data).
- "Update Dashboard" button → POSTs `{ passcode, data }` to `/api/update-data`.
- Show a clear success/failure state. On success: "Dashboard updating — live in about a
  minute." On failure: show the actual error, don't swallow it.

---

## `/api/update-data` route — requirements

- `POST` only.
- Verify `UPDATE_PASSCODE` server-side; reject with 401 if wrong or missing.
- Use `@octokit/rest` with a **fine-grained GitHub personal access token**, scoped to
  ONLY this one repo, with `contents: read and write` permission and nothing else.
  Store as `GITHUB_TOKEN` env var in Vercel (Production + Preview), never committed.
- Also need `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` (probably `main`) as env vars.
- Steps:
  1. Get the current SHA of `data/data.json` on the target branch (needed for the
     update call — GitHub's API requires it to avoid overwriting concurrent changes).
  2. `octokit.repos.createOrUpdateFileContents({ owner, repo, path: 'data/data.json',
     message: 'Update dashboard data', content: base64(JSON.stringify(data)), sha, branch })`
  3. Return `{ ok: true }` on success. Vercel's GitHub integration will pick up the push
     and auto-redeploy — nothing else to trigger manually.
- Wrap in try/catch, return meaningful error messages (e.g. rate limit, bad token,
  wrong repo name) — this is the only debugging signal the non-technical person's
  screen will show.

---

## Dashboard (`app/page.tsx`) — requirements

- Port everything from `index.html`: markup, CSS (into `globals.css`, keep the CSS
  variables and dark/light `data-theme` toggle logic intact), and all the
  `render*()` functions (`renderBusinessMetrics`, `renderProjectsIntoBody`,
  `renderProjectSections`, `renderPartnerSections`, the donut/KPI/SVG chart draw
  functions, etc.) — these are hand-rolled SVG, not a charting library, so they can
  be ported nearly verbatim, just adapted to run after data is fetched instead of
  after a manual file upload.
- On page load: fetch `/data/data.json` directly (it's a static file shipped in the
  deploy — no need for the `/api/data` route unless we want to add cache-busting or
  auth later; start simple, serve it as a static asset).
- Remove the old `<input type="file">` + `loadExcelFile()` call from the main
  dashboard — that flow moves entirely to `/upload`. The dashboard itself becomes
  read-only / display-only.
- Keep the existing theme toggle (dark/light via `localStorage`) — that's a
  per-user UI preference, not company data, so localStorage is fine for it.

---

## Local dev

```bash
npm install
npm run dev
```

Needs a `.env.local` with:
```
GITHUB_TOKEN=your_fine_grained_pat
GITHUB_OWNER=your-org-or-username
GITHUB_REPO=your-repo-name
GITHUB_BRANCH=main
UPDATE_PASSCODE=choose_something
```

---

## Deploy

1. Push this repo to GitHub.
2. Import the repo into Vercel (vercel.com → Add New Project → pick the repo).
   Vercel auto-detects Next.js, zero config needed.
3. Add the same env vars from `.env.local` into Vercel's Project Settings → Environment
   Variables (Production + Preview).
4. Every future data update happens through `/upload` → nobody needs to touch Vercel,
   GitHub's UI, or a terminal again after this initial setup.

---

## Explicit non-goals (don't add these — keep it simple)

- No database.
- No Vercel Blob / S3 / any third-party file storage.
- No GitHub Actions workflow — Vercel's native Git integration already auto-deploys on
  push, a separate Actions workflow would be redundant.
- No user accounts / full auth system — a single shared passcode is enough for this
  use case.
- No chart library migration — keep the existing hand-rolled inline SVG rendering
  exactly as it is in `index.html`.