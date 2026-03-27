# FrostChat

FrostChat is now structured for a public deployment path built around:

- `apps/web`: React + Vite web app for Vercel
- `apps/mobile`: Expo React Native app for EAS Android builds
- `packages/shared`: shared types, crypto helpers, and local-first utilities
- `supabase/`: SQL schema for auth-linked profiles, invite codes, groups, rooms, storage, and policies

The old local Express + Socket.IO app is still in the repo, but the web and mobile clients are now wired toward a Supabase-backed public architecture instead of depending on a machine on your local network.

## Public Stack

- Web hosting: Vercel
- Auth: Supabase Auth
- Database: Supabase Postgres
- Realtime: Supabase Realtime broadcast + presence
- File uploads: Supabase Storage public bucket
- Android builds: Expo EAS
- APK distribution: GitHub Releases or EAS internal distribution

## Environment

Copy `.env.example` to `.env` and fill in:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_STORAGE_BUCKET=attachments
VITE_INVITE_CODE=FROST-FRIENDS

EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET=attachments
EXPO_PUBLIC_INVITE_CODE=FROST-FRIENDS
```

For the web app on Vercel, `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are also accepted if you already have those set.

For local legacy-server development you can still keep:

```bash
SERVER_PORT=4000
CLIENT_ORIGIN=http://localhost:5173
INVITE_CODE=FROST-FRIENDS
```

## Supabase Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run the SQL files in [supabase/migrations](C:/PersonalDrive/Programming/WebDev/SText/supabase/migrations) in filename order.
3. In Supabase Auth settings, disable email confirmation if you want invite-based signup to feel instant.
4. Copy the project URL and anon key into `.env`.

What this schema provides:

- `profiles` linked to `auth.users`
- `invite_codes` for invite-only signup
- `groups` and `group_members`
- `rooms` and `room_members`
- public `attachments` storage bucket
- basic RLS policies for a small private app

## Web Deploy on Vercel

1. Import the repo into Vercel.
2. Set the project root to `apps/web`.
3. Add these environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_STORAGE_BUCKET`
   - `VITE_INVITE_CODE`
4. Deploy.

If your Vercel project already uses `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, the web app now accepts those too.

SPA rewrites are already defined in [vercel.json](C:/PersonalDrive/Programming/WebDev/SText/apps/web/vercel.json).

## Android APK with EAS

1. Install Expo/EAS CLI:

```bash
npm i -g eas-cli
```

2. From `apps/mobile`, log in and build:

```bash
eas login
eas build -p android --profile preview
```

3. Add these EAS env vars:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET`
   - `EXPO_PUBLIC_INVITE_CODE`

The EAS build profile is already defined in [eas.json](C:/PersonalDrive/Programming/WebDev/SText/apps/mobile/eas.json).

## Local Verification

Install dependencies:

```bash
npm install
```

Run typechecks:

```bash
npm run typecheck --workspace @frostchat/web
npm run typecheck --workspace @frostchat/mobile
```

Build the web app:

```bash
npm run build --workspace @frostchat/web
```

## Current Notes

- Web and mobile auth now assume Supabase email/password auth plus a profile username.
- Invite codes are now meant to be consumed through the `consume_invite_code` SQL function before public signup access is granted.
- Direct messages are still synthesized from the visible profile list.
- Secret chats remain local-only and PIN-encrypted.
- Realtime chat, typing, reactions, delete events, room presence, and room entry events are now designed around Supabase Realtime channels.
- Mobile attachments now expect Supabase Storage to be configured so shared media URLs remain valid across devices.
- The old server code is still present, but it is no longer the intended public deployment path.
