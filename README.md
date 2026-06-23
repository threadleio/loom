# CrowdPulse

Internal live audience-engagement platform — a self-hosted alternative to Mentimeter / Slido for
company meetings, all-hands, town halls, onboarding, and retrospectives. A host runs live polls,
word clouds, quizzes, and Q&A; participants join from their phones with a code and respond in real
time; results display on a dedicated projector view.

Built for the Wrocław Hackdays.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Prisma 7** + **SQLite**
- **NextAuth** (mock company SSO)
- **Socket.IO** over a custom Node server (`server.ts`) for realtime
- **Tailwind CSS 4** with three switchable visual skins (Loom / Arcade / Press)

## Getting started

```bash
npm install
npx prisma migrate dev    # create the local SQLite DB from migrations
npm run dev               # Next.js + Socket.IO on http://localhost:3000
```

Use `npm run dev` (not `next dev`) — it runs `server.ts`, which combines Next.js with the Socket.IO
server at `/api/socketio`.

`.env` needs `DATABASE_URL` (e.g. `file:./dev.db`), `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`. The local
`dev.db` is git-ignored; recreate it with `npx prisma migrate dev`.

## Surfaces / routes

| Route | Surface |
|---|---|
| `/` | Landing + join-by-code |
| `/login` | Credentials / mock SSO |
| `/create` | Create an event |
| `/events` | Host dashboard — events grouped by lifecycle status |
| `/event/[id]` | Participant view (phone) |
| `/event/[id]/host` | Host control panel |
| `/event/[id]/present` | Projector / big-screen view |
| `/event/[id]/analytics` | Post-event analytics + CSV export |

## Core concepts

- **Event** = one meeting. Carries a join code and a lifecycle: **draft → live → ended → archived**.
  Only `live` events accept joins. New events start as **draft** — the host clicks **Go Live** when
  ready.
- **Rooms** = optional parallel tracks inside an event (the default is a single "Main" room).
- **Polls** = multiple choice, word cloud, or quiz. The host launches one at a time per room;
  participants only ever see the currently active poll.
- **Q&A** = always-on audience questions with upvoting and optional host moderation.

## Demo flow

1. Sign in (SSO tab, any corporate email) → **Create Event** → **Go Live**.
2. Share the join code; participants open `/` and enter it.
3. Open `/event/[id]/present` on the projector.
4. From the host panel: launch polls/quizzes, highlight questions, show the leaderboard.
5. **End Event** when done, then review `/event/[id]/analytics`.

See [`PROJECT_FEATURES.md`](./PROJECT_FEATURES.md) for the full feature and architecture reference.
