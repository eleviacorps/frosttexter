import path from "node:path";

import Database from "better-sqlite3";

import { createInviteCode } from "@frostchat/shared";

export interface UserRow {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string | null;
  created_at: string;
}

export interface GroupRow {
  id: string;
  name: string;
  avatar_url: string | null;
  description: string | null;
  admin_id: string;
  created_at: string;
  updated_at: string;
}

export interface RoomRow {
  id: string;
  code: string;
  name: string;
  topic: string | null;
  host_id: string;
  now_playing: string | null;
  read_only: number;
  is_live: number;
  created_at: string;
  updated_at: string;
}

export function createDb() {
  const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), "frostchat.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    create table if not exists users (
      id text primary key,
      username text not null unique,
      passphrase_hash text not null,
      avatar_url text,
      status text,
      created_at text not null
    );

    create table if not exists sessions (
      token text primary key,
      user_id text not null,
      created_at text not null,
      foreign key (user_id) references users(id)
    );

    create table if not exists invite_codes (
      code text primary key,
      label text,
      expires_at text,
      created_at text not null
    );

    create table if not exists groups (
      id text primary key,
      name text not null,
      avatar_url text,
      description text,
      admin_id text not null,
      created_at text not null,
      updated_at text not null,
      foreign key (admin_id) references users(id)
    );

    create table if not exists group_members (
      group_id text not null,
      user_id text not null,
      muted integer default 0,
      joined_at text not null,
      primary key (group_id, user_id),
      foreign key (group_id) references groups(id),
      foreign key (user_id) references users(id)
    );

    create table if not exists rooms (
      id text primary key,
      code text not null unique,
      name text not null,
      topic text,
      host_id text not null,
      now_playing text,
      read_only integer default 0,
      is_live integer default 1,
      created_at text not null,
      updated_at text not null,
      foreign key (host_id) references users(id)
    );
  `);

  const inviteCode = process.env.INVITE_CODE || createInviteCode();
  db.prepare(
    "insert or ignore into invite_codes (code, label, created_at) values (?, ?, ?)",
  ).run(inviteCode, "Default FrostChat Invite", new Date().toISOString());

  return db;
}

