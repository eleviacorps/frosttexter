import type {
  AuthSession,
  ChatMessage,
  Conversation,
  DeleteEvent,
  LiveRoom,
  ReactionEvent,
  UploadConfig,
} from "@frostchat/shared";

import { backend } from "./backend";

export const api = {
  baseUrl: backend.baseUrl,
  login(email: string, passphrase: string, inviteCode: string, username: string) {
    return backend.login(email, passphrase, inviteCode, username);
  },
  me(token: string, refreshToken?: string) {
    return backend.me(token, refreshToken);
  },
  messages(session: AuthSession, conversationId: string): Promise<ChatMessage[]> {
    return backend.messages(session, conversationId);
  },
  uploadConfig(token: string): Promise<UploadConfig> {
    return backend.uploadConfig(token);
  },
  saveMessage(session: AuthSession, payload: { message: ChatMessage; targetUserIds: string[] }) {
    return backend.saveMessage(session, payload);
  },
  updateMessageStatus(
    session: AuthSession,
    payload: { conversationId: string; messageId: string; status: ChatMessage["status"]; userId: string },
  ) {
    return backend.updateMessageStatus(session, payload);
  },
  updateReaction(session: AuthSession, payload: ReactionEvent) {
    return backend.updateReaction(session, payload);
  },
  updateDelete(session: AuthSession, payload: DeleteEvent) {
    return backend.updateDelete(session, payload);
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
