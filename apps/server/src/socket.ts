import type { Server as HttpServer } from "node:http";

import type Database from "better-sqlite3";
import { Server } from "socket.io";

import type {
  ChatMessage,
  DeleteEvent,
  FrostUser,
  LiveRoom,
  MessageRelayEvent,
  ReactionEvent,
  RoomParticipant,
  TypingPayload,
} from "@frostchat/shared";

import { getUserFromToken } from "./auth";
import type { RoomRow } from "./db";

function roomRowToPayload(row: RoomRow, participants: RoomParticipant[] = []): LiveRoom {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    topic: row.topic ?? undefined,
    hostId: row.host_id,
    nowPlaying: row.now_playing ?? undefined,
    readOnly: Boolean(row.read_only),
    isLive: Boolean(row.is_live),
    participants,
    updatedAt: row.updated_at,
  };
}

export function registerSocketServer(server: HttpServer, db: Database.Database, origin: string) {
  const io = new Server(server, {
    cors: {
      origin,
      credentials: true,
    },
  });

  const onlineUsers = new Map<string, Set<string>>();
  const temporaryMessages = new Map<string, ChatMessage[]>();
  const roomParticipants = new Map<string, Map<string, RoomParticipant>>();

  function broadcastPresence() {
    io.emit("presence:update", Array.from(onlineUsers.keys()));
  }

  function rememberMessage(message: ChatMessage) {
    if (message.kind === "secret") {
      return;
    }

    const current = temporaryMessages.get(message.conversationId) ?? [];
    temporaryMessages.set(message.conversationId, [message, ...current].slice(0, 100));
  }

  io.use((socket, next) => {
    const token =
      typeof socket.handshake.auth.token === "string"
        ? socket.handshake.auth.token
        : undefined;
    const user = getUserFromToken(db, token);

    if (!token || !user) {
      next(new Error("Unauthorized"));
      return;
    }

    socket.data.user = user;
    socket.data.token = token;
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as FrostUser;
    const userSockets = onlineUsers.get(user.id) ?? new Set<string>();
    userSockets.add(socket.id);
    onlineUsers.set(user.id, userSockets);
    socket.join(`user:${user.id}`);
    broadcastPresence();

    socket.on("conversation:join", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      socket.emit("conversation:cache", temporaryMessages.get(conversationId) ?? []);
    });

    socket.on("typing:start", (payload: TypingPayload) => {
      socket.to(`conversation:${payload.conversationId}`).emit("typing:update", payload);
    });

    socket.on("typing:stop", (payload: TypingPayload) => {
      socket.to(`conversation:${payload.conversationId}`).emit("typing:clear", payload);
    });

    socket.on("message:send", (event: MessageRelayEvent) => {
      rememberMessage(event.message);
      io.to(`conversation:${event.message.conversationId}`).emit("message:new", event.message);
      event.targetUserIds.forEach((targetUserId) => {
        io.to(`user:${targetUserId}`).emit("message:new", event.message);
      });
    });

    socket.on(
      "message:status",
      (payload: {
        conversationId: string;
        messageId: string;
        status: ChatMessage["status"];
        userId: string;
        targetUserIds: string[];
      }) => {
        io.to(`conversation:${payload.conversationId}`).emit("message:status", payload);
        payload.targetUserIds.forEach((targetUserId) => {
          io.to(`user:${targetUserId}`).emit("message:status", payload);
        });
      },
    );

    socket.on("message:react", (payload: ReactionEvent) => {
      io.to(`conversation:${payload.conversationId}`).emit("message:react", payload);
    });

    socket.on("message:delete", (payload: DeleteEvent) => {
      io.to(`conversation:${payload.conversationId}`).emit("message:delete", payload);
    });

    socket.on("room:join", (roomId: string) => {
      socket.join(`room:${roomId}`);
      const room = db.prepare("select * from rooms where id = ?").get(roomId) as RoomRow | undefined;
      if (!room) {
        return;
      }

      const participants = roomParticipants.get(roomId) ?? new Map<string, RoomParticipant>();
      participants.set(user.id, {
        userId: user.id,
        username: user.username,
        joinedAt: new Date().toISOString(),
      });
      roomParticipants.set(roomId, participants);
      io.to(`room:${roomId}`).emit("room:participants", {
        roomId,
        participants: Array.from(participants.values()),
      });
      io.to(`room:${roomId}`).emit("room:updated", roomRowToPayload(room, Array.from(participants.values())));
      io.to(`room:${roomId}`).emit("room:entry", `${user.username} joined the room`);
    });

    socket.on("room:leave", (roomId: string) => {
      socket.leave(`room:${roomId}`);
      const participants = roomParticipants.get(roomId);
      if (!participants) {
        return;
      }

      participants.delete(user.id);
      io.to(`room:${roomId}`).emit("room:participants", {
        roomId,
        participants: Array.from(participants.values()),
      });
    });

    socket.on("room:now-playing", (payload: { roomId: string; nowPlaying: string }) => {
      db.prepare("update rooms set now_playing = ?, updated_at = ? where id = ?")
        .run(payload.nowPlaying, new Date().toISOString(), payload.roomId);
      const room = db.prepare("select * from rooms where id = ?").get(payload.roomId) as RoomRow | undefined;
      if (room) {
        io.to(`room:${payload.roomId}`).emit(
          "room:updated",
          roomRowToPayload(room, Array.from(roomParticipants.get(payload.roomId)?.values() ?? [])),
        );
      }
    });

    socket.on("room:mute", (payload: { roomId: string; readOnly: boolean }) => {
      db.prepare("update rooms set read_only = ?, updated_at = ? where id = ?")
        .run(payload.readOnly ? 1 : 0, new Date().toISOString(), payload.roomId);
      const room = db.prepare("select * from rooms where id = ?").get(payload.roomId) as RoomRow | undefined;
      if (room) {
        io.to(`room:${payload.roomId}`).emit(
          "room:updated",
          roomRowToPayload(room, Array.from(roomParticipants.get(payload.roomId)?.values() ?? [])),
        );
      }
    });

    socket.on("room:kick", (payload: { roomId: string; userId: string }) => {
      const participants = roomParticipants.get(payload.roomId);
      participants?.delete(payload.userId);
      io.to(`user:${payload.userId}`).emit("room:kicked", payload.roomId);
      io.to(`room:${payload.roomId}`).emit("room:participants", {
        roomId: payload.roomId,
        participants: Array.from(participants?.values() ?? []),
      });
    });

    socket.on("disconnect", () => {
      const tracked = onlineUsers.get(user.id);
      tracked?.delete(socket.id);
      if (!tracked || tracked.size === 0) {
        onlineUsers.delete(user.id);
      }
      broadcastPresence();

      roomParticipants.forEach((participants, roomId) => {
        if (participants.delete(user.id)) {
          io.to(`room:${roomId}`).emit("room:participants", {
            roomId,
            participants: Array.from(participants.values()),
          });
        }
      });
    });
  });

  return io;
}
