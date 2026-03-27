import crypto from "node:crypto";

import type Database from "better-sqlite3";
import type { Request, Response, NextFunction } from "express";

import { createEntityId } from "@frostchat/shared";

import type { UserRow } from "./db";

export function hashPassphrase(passphrase: string) {
  return crypto.scryptSync(passphrase, "frostchat", 32).toString("hex");
}

export function createSession(db: Database.Database, userId: string) {
  const token = createEntityId("sess");
  db.prepare("insert into sessions (token, user_id, created_at) values (?, ?, ?)")
    .run(token, userId, new Date().toISOString());
  return token;
}

export function getUserFromToken(db: Database.Database, token?: string) {
  if (!token) {
    return null;
  }

  const row = db
    .prepare(
      `select u.id, u.username, u.avatar_url, u.status, u.created_at
       from sessions s
       join users u on u.id = s.user_id
       where s.token = ?`,
    )
    .get(token) as UserRow | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url ?? undefined,
    status: row.status ?? undefined,
  };
}

export interface AuthedRequest extends Request {
  auth: {
    token: string;
    user: {
      id: string;
      username: string;
      avatarUrl?: string;
      status?: string;
    };
  };
}

export function requireAuth(db: Database.Database) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.replace(/^Bearer\s+/i, "");
    const user = getUserFromToken(db, token);

    if (!token || !user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    (req as AuthedRequest).auth = { token, user };
    next();
  };
}

