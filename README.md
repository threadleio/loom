# Loom

Internal live audience-engagement platform — a self-hosted alternative to Mentimeter / Slido for
company meetings, all-hands, town halls, onboarding, and retrospectives. A host runs live polls,
word clouds, quizzes, and Q&A; participants join from their phones with a code (or a QR scan) and
respond in real time; a dedicated stage view drives the room from the projector.

Built for the Wrocław Hackdays. (Internal codename — unrelated to the video tool of the same name.)

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Prisma 7** + **SQLite** (via `@prisma/adapter-better-sqlite3`)
- **NextAuth** (JWT sessions; mock company SSO, guest, and credentials providers)
- **Socket.IO** over a custom Node server (`server.ts`) for realtime fan-out
- **Tailwind CSS 4** with a single committed neon visual identity

## Getting started

```bash
npm install               # also runs `prisma generate` (postinstall)
npx prisma migrate dev    # create the local SQLite DB from migrations
npm run dev               # Next.js + Socket.IO on http://localhost:3000
```

Use `npm run dev` (not `next dev`) — it runs `server.ts`, which combines Next.js with the Socket.IO
server at `/api/socketio`.

`.env` needs `DATABASE_URL` (e.g. `file:./dev.db`), `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`. The local
`dev.db` and the generated Prisma client (`app/generated/prisma`) are git-ignored; recreate them with
`npx prisma migrate dev` (or `npx prisma generate`).

> **Two things that bite during development:** the custom server (`server.ts`) is **not** hot-reloaded —
> restart `npm run dev` after editing it. And a `prisma migrate` regenerates the client, but a
> already-running dev server keeps the **old** client in memory — restart after migrating too.

## Surfaces / routes

| Route | Surface |
|---|---|
| `/` | Host-first landing — create a session, or join by code |
| `/login` | Credentials / registration / mock SSO |
| `/events` | Host dashboard — events grouped by lifecycle status, with delete |
| `/join/[code]` | Direct join link (what a QR code points at) |
| `/event/[id]` | Participant view (phone) |
| `/event/[id]/host` | Host control panel — setup, settings, deck, moderation |
| `/event/[id]/present` | Stage / projector view; `?control=1` adds the presenter control rail |
| `/event/[id]/analytics` | Post-event analytics + CSV export |

There is no `/create` page — creating an event is a single click from the home page or dashboard
(`POST /api/events`, name optional), which drops the host onto the host panel. The event starts as a
**draft**; the host clicks **Go Live** when ready.

## Core concepts

- **Event** = one meeting. Carries a join code and a lifecycle: **draft → live → ended → archived**.
  Only `live` events accept joins. New events start as **draft** — the host clicks **Go Live** when
  ready, and can **End** and **Reopen**/**Archive** later. An event also carries policy toggles:
  **question moderation** and **anonymous questions** (Open vs Names-required), both changeable any
  time from the host Settings card.
- **Rooms** = optional parallel tracks inside an event (the default is a single "Main" room).
- **Polls** = multiple choice, word cloud, or quiz. The host builds a **deck** of drafts (reorder,
  edit, delete), then launches them one at a time per room; participants only ever see the active
  one. Quizzes have a timer and **configurable points** — either a **speed** bonus (50–100% of the
  points by how fast you answer) or a **flat** award per correct answer.
- **Q&A** = always-on audience questions with upvoting, optional host moderation, and **host answers**
  (an answer the host types shows up on phones and in the export).
- **Stage** = the projector view, driven by the host from the control rail (`?control=1`). It walks a
  two-beat deck per poll — **Live → Results** — revealing the correct answer and this question's
  scoreboard on the results beat, with a non-destructive **Overall leaderboard** overlay on demand.
  A **QR code** + join code sit in the corner so the room can join hands-free.

## Demo flow

1. Sign in (SSO tab, any corporate email) → **Create** a session — you land on the host panel (a draft).
2. Click **Go Live**, then share the join code or QR; participants open `/` or scan, and enter the code.
3. Open the stage on the projector: `/event/[id]/present?control=1`.
4. From the control rail: **Next** walks the deck (Start → Results → next poll); raise the
   **Overall** leaderboard any time; highlight a question from the host panel to push it full-screen.
5. **End Event** when done, then review `/event/[id]/analytics` and export CSV.

## Deployment

The app ships as a **Render Web Service** (a long-running Node process — not a static site or
serverless functions, both of which would break the WebSocket server and the SQLite writes). The
[`render.yaml`](./render.yaml) blueprint provisions the service, a 1 GB persistent disk for the
SQLite file, build/start commands (`prisma generate` + `next build`, then `prisma migrate deploy` +
seed + start), and the env vars. After the first deploy, set `NEXTAUTH_URL` to the public URL and
redeploy. `prisma/seed.ts` seeds a fallback host on every deploy.

See [`PROJECT_FEATURES.md`](./PROJECT_FEATURES.md) for the full feature, schema, API, and realtime
reference.
