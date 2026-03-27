import http from "node:http";
import path from "node:path";

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";

import type { BootstrapPayload, Conversation, LiveRoom } from "@frostchat/shared";
import { createEntityId } from "@frostchat/shared";

import { AuthedRequest, createSession, getUserFromToken, hashPassphrase, requireAuth } from "./auth";
import { createDb, type GroupRow, type RoomRow, type UserRow } from "./db";
import { registerSocketServer } from "./socket";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

const app = express();
const server = http.createServer(app);
const db = createDb();
const port = Number(process.env.SERVER_PORT || 4000);
const origin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));

function userRowToPayload(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url ?? undefined,
    status: row.status ?? undefined,
  };
}

function groupRowToConversation(row: GroupRow): Conversation {
  const members = db
    .prepare("select user_id from group_members where group_id = ?")
    .all(row.id) as Array<{ user_id: string }>;
  return {
    id: row.id,
    kind: "group",
    title: row.name,
    participantIds: members.map((member) => member.user_id),
    avatarUrl: row.avatar_url ?? undefined,
    adminIds: [row.admin_id],
    description: row.description ?? undefined,
    updatedAt: row.updated_at,
  };
}

function roomRowToPayload(row: RoomRow): LiveRoom {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    topic: row.topic ?? undefined,
    hostId: row.host_id,
    nowPlaying: row.now_playing ?? undefined,
    readOnly: Boolean(row.read_only),
    isLive: Boolean(row.is_live),
    participants: [],
    updatedAt: row.updated_at,
  };
}

function bootstrapForUser(token: string): BootstrapPayload | null {
  const user = getUserFromToken(db, token);
  if (!user) {
    return null;
  }

  const users = (db.prepare("select id, username, avatar_url, status, created_at from users order by username asc").all() as UserRow[])
    .map(userRowToPayload);

  const groups = (
    db.prepare(
      `select g.*
       from groups g
       join group_members gm on gm.group_id = g.id
       where gm.user_id = ?
       order by g.updated_at desc`,
    ).all(user.id) as GroupRow[]
  ).map(groupRowToConversation);

  const dmConversations: Conversation[] = users
    .filter((candidate) => candidate.id !== user.id)
    .map((candidate) => ({
      id: ["dm", ...[user.id, candidate.id].sort()].join("_"),
      kind: "dm",
      title: candidate.username,
      participantIds: [user.id, candidate.id],
      avatarUrl: candidate.avatarUrl,
      updatedAt: new Date().toISOString(),
    }));

  const rooms = (db.prepare("select * from rooms order by updated_at desc").all() as RoomRow[]).map(roomRowToPayload);

  return {
    session: {
      token,
      user,
    },
    users,
    conversations: [...groups, ...dmConversations],
    rooms,
    inviteCodeHint: process.env.INVITE_CODE || "FROST-FRIENDS",
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

const loginSchema = z.object({
  username: z.string().min(2).max(32),
  passphrase: z.string().min(4),
  inviteCode: z.string().min(4),
});

app.post("/api/auth/login", (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid auth payload" });
    return;
  }

  const { username, passphrase, inviteCode } = result.data;
  const invite = db.prepare("select code from invite_codes where code = ?").get(inviteCode) as
    | { code: string }
    | undefined;

  if (!invite) {
    res.status(403).json({ error: "Invite code is invalid" });
    return;
  }

  const existing = db
    .prepare("select * from users where lower(username) = lower(?)")
    .get(username) as (UserRow & { passphrase_hash: string }) | undefined;
  let userId = existing?.id;

  if (existing) {
    if (existing.passphrase_hash !== hashPassphrase(passphrase)) {
      res.status(401).json({ error: "Incorrect passphrase" });
      return;
    }
  } else {
    userId = createEntityId("usr");
    db.prepare(
      "insert into users (id, username, passphrase_hash, created_at) values (?, ?, ?, ?)",
    ).run(userId, username, hashPassphrase(passphrase), new Date().toISOString());
  }

  const token = createSession(db, userId!);
  const payload = bootstrapForUser(token);
  res.json(payload);
});

app.get("/api/auth/me", requireAuth(db), (req, res) => {
  const authed = req as AuthedRequest;
  res.json(bootstrapForUser(authed.auth.token));
});

app.get("/api/users", requireAuth(db), (_req, res) => {
  const users = (db.prepare("select id, username, avatar_url, status, created_at from users order by username asc").all() as UserRow[])
    .map(userRowToPayload);
  res.json(users);
});

const groupSchema = z.object({
  name: z.string().min(2).max(64),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().max(180).optional().or(z.literal("")),
  memberIds: z.array(z.string()).min(1),
});

app.post("/api/groups", requireAuth(db), (req, res) => {
  const authed = req as AuthedRequest;
  const result = groupSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid group payload" });
    return;
  }

  const id = createEntityId("grp");
  const now = new Date().toISOString();
  db.prepare(
    "insert into groups (id, name, avatar_url, description, admin_id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    result.data.name,
    result.data.avatarUrl || null,
    result.data.description || null,
    authed.auth.user.id,
    now,
    now,
  );

  const memberIds = Array.from(new Set([authed.auth.user.id, ...result.data.memberIds]));
  const insert = db.prepare(
    "insert into group_members (group_id, user_id, joined_at) values (?, ?, ?)",
  );
  const transaction = db.transaction((ids: string[]) => {
    ids.forEach((memberId) => insert.run(id, memberId, now));
  });
  transaction(memberIds);

  const row = db.prepare("select * from groups where id = ?").get(id) as GroupRow;
  res.status(201).json(groupRowToConversation(row));
});

app.patch("/api/groups/:groupId", requireAuth(db), (req, res) => {
  const authed = req as AuthedRequest;
  const group = db.prepare("select * from groups where id = ?").get(req.params.groupId) as GroupRow | undefined;
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  if (group.admin_id !== authed.auth.user.id) {
    res.status(403).json({ error: "Only admins can update groups" });
    return;
  }

  const nextName = typeof req.body.name === "string" ? req.body.name : group.name;
  const nextAvatar = typeof req.body.avatarUrl === "string" ? req.body.avatarUrl : group.avatar_url;
  const nextDescription =
    typeof req.body.description === "string" ? req.body.description : group.description;

  db.prepare("update groups set name = ?, avatar_url = ?, description = ?, updated_at = ? where id = ?").run(
    nextName,
    nextAvatar,
    nextDescription,
    new Date().toISOString(),
    group.id,
  );

  res.json(groupRowToConversation(db.prepare("select * from groups where id = ?").get(group.id) as GroupRow));
});

app.post("/api/groups/:groupId/members", requireAuth(db), (req, res) => {
  const authed = req as AuthedRequest;
  const group = db.prepare("select * from groups where id = ?").get(req.params.groupId) as GroupRow | undefined;
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  if (group.admin_id !== authed.auth.user.id) {
    res.status(403).json({ error: "Only admins can add members" });
    return;
  }

  const memberIds = z.array(z.string()).safeParse(req.body.memberIds);
  if (!memberIds.success) {
    res.status(400).json({ error: "Invalid member ids" });
    return;
  }

  const insert = db.prepare(
    "insert or ignore into group_members (group_id, user_id, joined_at) values (?, ?, ?)",
  );
  memberIds.data.forEach((memberId) => insert.run(group.id, memberId, new Date().toISOString()));
  res.json(groupRowToConversation(group));
});

app.delete("/api/groups/:groupId/members/:userId", requireAuth(db), (req, res) => {
  const authed = req as AuthedRequest;
  const group = db.prepare("select * from groups where id = ?").get(req.params.groupId) as GroupRow | undefined;
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  if (group.admin_id !== authed.auth.user.id && req.params.userId !== authed.auth.user.id) {
    res.status(403).json({ error: "Not allowed to remove this member" });
    return;
  }
  db.prepare("delete from group_members where group_id = ? and user_id = ?").run(group.id, req.params.userId);
  res.status(204).send();
});

app.post("/api/groups/:groupId/mute", requireAuth(db), (req, res) => {
  const authed = req as AuthedRequest;
  const muted = Boolean(req.body.muted);
  db.prepare("update group_members set muted = ? where group_id = ? and user_id = ?").run(
    muted ? 1 : 0,
    req.params.groupId,
    authed.auth.user.id,
  );
  res.json({ ok: true, muted });
});

const roomSchema = z.object({
  name: z.string().min(2).max(64),
  topic: z.string().max(180).optional().or(z.literal("")),
});

app.get("/api/rooms", requireAuth(db), (_req, res) => {
  const rooms = (db.prepare("select * from rooms order by updated_at desc").all() as RoomRow[]).map(roomRowToPayload);
  res.json(rooms);
});

app.post("/api/rooms", requireAuth(db), (req, res) => {
  const authed = req as AuthedRequest;
  const result = roomSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid room payload" });
    return;
  }

  const id = createEntityId("room");
  const now = new Date().toISOString();
  db.prepare(
    "insert into rooms (id, code, name, topic, host_id, is_live, created_at, updated_at) values (?, ?, ?, ?, ?, 1, ?, ?)",
  ).run(id, createEntityId("join"), result.data.name, result.data.topic || null, authed.auth.user.id, now, now);

  const row = db.prepare("select * from rooms where id = ?").get(id) as RoomRow;
  res.status(201).json(roomRowToPayload(row));
});

app.patch("/api/rooms/:roomId", requireAuth(db), (req, res) => {
  const authed = req as AuthedRequest;
  const room = db.prepare("select * from rooms where id = ?").get(req.params.roomId) as RoomRow | undefined;
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  if (room.host_id !== authed.auth.user.id) {
    res.status(403).json({ error: "Only the host can update this room" });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(
    "update rooms set name = ?, topic = ?, now_playing = ?, read_only = ?, is_live = ?, updated_at = ? where id = ?",
  ).run(
    typeof req.body.name === "string" ? req.body.name : room.name,
    typeof req.body.topic === "string" ? req.body.topic : room.topic,
    typeof req.body.nowPlaying === "string" ? req.body.nowPlaying : room.now_playing,
    typeof req.body.readOnly === "boolean" ? (req.body.readOnly ? 1 : 0) : room.read_only,
    typeof req.body.isLive === "boolean" ? (req.body.isLive ? 1 : 0) : room.is_live,
    now,
    room.id,
  );

  res.json(roomRowToPayload(db.prepare("select * from rooms where id = ?").get(room.id) as RoomRow));
});

app.get("/api/uploads/config", requireAuth(db), (_req, res) => {
  res.json({
    bucket: process.env.SUPABASE_STORAGE_BUCKET || "attachments",
  });
});

registerSocketServer(server, db, origin);

server.listen(port, () => {
  console.log(`FrostChat server listening on ${port}`);
});
