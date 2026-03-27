import type { AuthSession, Conversation, LiveRoom, UploadConfig } from "@frostchat/shared";

import { backend } from "./backend";

export const api = {
  baseUrl: backend.baseUrl,
  login(email: string, passphrase: string, inviteCode: string, username: string) {
    return backend.login(email, passphrase, inviteCode, username);
  },
  me(token: string, refreshToken?: string) {
    return backend.me(token, refreshToken);
  },
  uploadConfig(token: string): Promise<UploadConfig> {
    return backend.uploadConfig(token);
  },
  createGroup(
    session: AuthSession,
    payload: { name: string; description?: string; memberIds: string[]; avatarUrl?: string },
  ): Promise<Conversation> {
    return backend.createGroup(session, payload);
  },
  createRoom(session: AuthSession, payload: { name: string; topic?: string }): Promise<LiveRoom> {
    return backend.createRoom(session, payload);
  },
  updateRoom(
    _session: AuthSession,
    roomId: string,
    payload: Partial<{ name: string; topic: string; nowPlaying: string; readOnly: boolean; isLive: boolean }>,
  ): Promise<LiveRoom> {
    return backend.updateRoom(roomId, payload);
  },
  joinRoom(session: AuthSession, roomId: string) {
    return backend.joinRoom(session, roomId);
  },
  leaveRoom(session: AuthSession, roomId: string) {
    return backend.leaveRoom(session, roomId);
  },
};
