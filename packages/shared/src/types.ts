export type ChatKind = "dm" | "group" | "room" | "secret";

export type MessageType =
  | "text"
  | "emoji"
  | "reply"
  | "voice"
  | "image"
  | "video"
  | "document"
  | "system";

export type DeliveryState = "sending" | "sent" | "delivered" | "seen" | "deleted";

export interface FrostUser {
  id: string;
  username: string;
  avatarUrl?: string;
  status?: string;
  lastSeenAt?: string;
}

export type FollowState =
  | "none"
  | "outgoing_pending"
  | "incoming_pending"
  | "accepted"
  | "blocked"
  | "blocked_by";

export interface DiscoveryProfile extends FrostUser {
  relationship: FollowState;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Attachment {
  id: string;
  kind: "image" | "video" | "document" | "voice";
  url: string;
  name: string;
  mimeType?: string;
  durationMs?: number;
  bytes?: number;
  waveform?: number[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  kind: ChatKind;
  type: MessageType;
  senderId: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  replyToId?: string;
  attachments?: Attachment[];
  reactions?: Reaction[];
  status: DeliveryState;
  deliveredTo?: string[];
  seenBy?: string[];
  mentions?: string[];
  isSecret?: boolean;
  deletedForEveryone?: boolean;
  selfDestructSeconds?: number;
  destructAt?: string;
}

export interface Conversation {
  id: string;
  kind: Extract<ChatKind, "dm" | "group" | "secret">;
  title: string;
  participantIds: string[];
  avatarUrl?: string;
  adminIds?: string[];
  mutedBy?: string[];
  hidden?: boolean;
  secretLocked?: boolean;
  description?: string;
  updatedAt: string;
  lastMessagePreview?: string;
}

export interface RoomParticipant {
  userId: string;
  joinedAt: string;
  username?: string;
}

export interface LiveRoom {
  id: string;
  code: string;
  name: string;
  topic?: string;
  hostId: string;
  nowPlaying?: string;
  readOnly?: boolean;
  isLive: boolean;
  participants: RoomParticipant[];
  updatedAt: string;
}

export interface AuthSession {
  token: string;
  refreshToken?: string;
  user: FrostUser;
}

export interface BootstrapPayload {
  session: AuthSession;
  users: FrostUser[];
  conversations: Conversation[];
  rooms: LiveRoom[];
  inviteCodeHint?: string;
}

export interface TypingPayload {
  conversationId: string;
  kind: ChatKind;
  userId: string;
}

export interface UploadConfig {
  bucket: string;
}

export interface SecretEnvelope {
  iv: string;
  cipherText: string;
}

export interface MessageRelayEvent {
  message: ChatMessage;
  targetUserIds: string[];
}

export interface ReactionEvent {
  conversationId: string;
  messageId: string;
  emoji: string;
  userId: string;
}

export interface DeleteEvent {
  conversationId: string;
  messageId: string;
  deletedBy: string;
  everyone: boolean;
}
