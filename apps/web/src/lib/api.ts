import type {
  AuthSession,
  ChatMessage,
  Conversation,
  DeleteEvent,
  DiscoveryProfile,
  FrostUser,
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
  updateProfile(
    session: AuthSession,
    payload: { username: string; status?: string; avatarUrl?: string },
  ): Promise<FrostUser> {
    return backend.updateProfile(session, payload);
  },
  socialGraph(session: AuthSession): Promise<{
    connections: DiscoveryProfile[];
    incomingRequests: DiscoveryProfile[];
    outgoingRequests: DiscoveryProfile[];
    blockedProfiles: DiscoveryProfile[];
  }> {
    return backend.socialGraph(session);
  },
  searchProfiles(session: AuthSession, query: string): Promise<DiscoveryProfile[]> {
    return backend.searchProfiles(session, query);
  },
  sendFollowRequest(session: AuthSession, targetUserId: string): Promise<DiscoveryProfile> {
    return backend.sendFollowRequest(session, targetUserId);
  },
  acceptFollowRequest(session: AuthSession, targetUserId: string): Promise<DiscoveryProfile> {
    return backend.acceptFollowRequest(session, targetUserId);
  },
  declineFollowRequest(session: AuthSession, targetUserId: string) {
    return backend.declineFollowRequest(session, targetUserId);
  },
  removeConnection(session: AuthSession, targetUserId: string) {
    return backend.removeConnection(session, targetUserId);
  },
  blockUser(session: AuthSession, targetUserId: string): Promise<DiscoveryProfile> {
    return backend.blockUser(session, targetUserId);
  },
  unblockUser(session: AuthSession, targetUserId: string): Promise<DiscoveryProfile> {
    return backend.unblockUser(session, targetUserId);
  },
  removeConversation(session: AuthSession, conversationId: string) {
    return backend.removeConversation(session, conversationId);
  },
  restoreConversation(session: AuthSession, conversationId: string) {
    return backend.restoreConversation(session, conversationId);
  },
  createGroup(
    session: AuthSession,
    payload: { name: string; description?: string; memberIds: string[]; avatarUrl?: string },
  ): Promise<Conversation> {
    return backend.createGroup(session, payload);
  },
  updateGroup(
    session: AuthSession,
    groupId: string,
    payload: { name: string; description?: string; avatarUrl?: string },
  ): Promise<Conversation> {
    return backend.updateGroup(session, groupId, payload);
  },
  addGroupMembers(session: AuthSession, groupId: string, memberIds: string[]): Promise<Conversation> {
    return backend.addGroupMembers(session, groupId, memberIds);
  },
  removeGroupMember(session: AuthSession, groupId: string, memberId: string): Promise<Conversation> {
    return backend.removeGroupMember(session, groupId, memberId);
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
