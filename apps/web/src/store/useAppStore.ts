import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  Attachment,
  AuthSession,
  BootstrapPayload,
  ChatKind,
  ChatMessage,
  Conversation,
  DeleteEvent,
  LiveRoom,
  ReactionEvent,
  UploadConfig,
} from "@frostchat/shared";
import {
  createEntityId,
  decryptSecretText,
  encryptSecretText,
  summarizeMessage,
  upsertById,
} from "@frostchat/shared";

interface AppState {
  hasHydrated: boolean;
  session?: AuthSession;
  users: BootstrapPayload["users"];
  conversations: Conversation[];
  rooms: LiveRoom[];
  messagesByConversation: Record<string, ChatMessage[]>;
  activeConversationId?: string;
  activeRoomId?: string;
  onlineUserIds: string[];
  typingByConversation: Record<string, string[]>;
  replyTo?: ChatMessage;
  uploadConfig?: UploadConfig;
  lightbox?: Attachment;
  secretPin?: string;
  secretUnlocked: boolean;
  secretWarningVisible: boolean;
  socketConnected: boolean;
  hydrate: (payload: BootstrapPayload) => void;
  setHasHydrated: (value: boolean) => void;
  logout: () => void;
  setActiveConversation: (conversationId?: string) => void;
  setActiveRoom: (roomId?: string) => void;
  setUploadConfig: (config: UploadConfig) => void;
  setOnlineUsers: (userIds: string[]) => void;
  setTyping: (conversationId: string, userId: string, active: boolean) => void;
  addMessage: (message: ChatMessage) => void;
  mergeMessages: (conversationId: string, messages: ChatMessage[]) => void;
  updateMessageStatus: (payload: {
    conversationId: string;
    messageId: string;
    status: ChatMessage["status"];
    userId: string;
  }) => void;
  toggleReaction: (payload: ReactionEvent) => void;
  deleteMessage: (payload: DeleteEvent) => void;
  setReplyTo: (message?: ChatMessage) => void;
  setSocketConnected: (connected: boolean) => void;
  openLightbox: (attachment: Attachment) => void;
  closeLightbox: () => void;
  upsertConversation: (conversation: Conversation) => void;
  upsertRoom: (room: LiveRoom) => void;
  upsertRoomParticipants: (roomId: string, participants: LiveRoom["participants"]) => void;
  setSecretPin: (pin: string) => void;
  unlockSecret: (pin: string) => boolean;
  lockSecret: () => void;
  showSecretWarning: (visible: boolean) => void;
  createSecretConversation: (title: string, participantIds: string[]) => Conversation;
  createOutgoingMessage: (input: {
    conversation: { id: string; kind: ChatKind };
    body: string;
    attachments?: Attachment[];
    replyToId?: string;
    selfDestructSeconds?: number;
  }) => ChatMessage;
  readSecretMessage: (conversationId: string, messageId: string) => string;
}

function sortConversations(
  conversations: Conversation[],
  messagesByConversation: Record<string, ChatMessage[]>,
) {
  return [...conversations].sort((a, b) => {
    const aLast = messagesByConversation[a.id]?.[0]?.createdAt ?? a.updatedAt;
    const bLast = messagesByConversation[b.id]?.[0]?.createdAt ?? b.updatedAt;
    return new Date(bLast).getTime() - new Date(aLast).getTime();
  });
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      users: [],
      conversations: [],
      rooms: [],
      messagesByConversation: {},
      onlineUserIds: [],
      typingByConversation: {},
      secretUnlocked: false,
      secretWarningVisible: false,
      socketConnected: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      hydrate: (payload) =>
        set((state) => ({
          session: payload.session,
          users: payload.users,
          conversations: sortConversations(
            payload.conversations.map((conversation) => ({
              ...conversation,
              lastMessagePreview: state.messagesByConversation[conversation.id]?.[0]
                ? summarizeMessage(state.messagesByConversation[conversation.id][0])
                : conversation.lastMessagePreview,
            })),
            state.messagesByConversation,
          ),
          rooms: payload.rooms,
          activeConversationId: state.activeConversationId || payload.conversations[0]?.id,
        })),
      logout: () =>
        set({
          session: undefined,
          users: [],
          conversations: [],
          rooms: [],
          messagesByConversation: {},
          activeConversationId: undefined,
          activeRoomId: undefined,
          secretUnlocked: false,
          socketConnected: false,
        }),
      setActiveConversation: (activeConversationId) => set({ activeConversationId }),
      setActiveRoom: (activeRoomId) => set({ activeRoomId }),
      setUploadConfig: (uploadConfig) => set({ uploadConfig }),
      setOnlineUsers: (onlineUserIds) => set({ onlineUserIds }),
      setTyping: (conversationId, userId, active) =>
        set((state) => {
          const current = state.typingByConversation[conversationId] ?? [];
          return {
            typingByConversation: {
              ...state.typingByConversation,
              [conversationId]: active
                ? Array.from(new Set([...current, userId]))
                : current.filter((id) => id !== userId),
            },
          };
        }),
      addMessage: (message) =>
        set((state) => {
          const current = state.messagesByConversation[message.conversationId] ?? [];
          const nextMessages = upsertById(current, message).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          const nextConversations = state.conversations.map((conversation) =>
            conversation.id === message.conversationId
              ? {
                  ...conversation,
                  updatedAt: message.createdAt,
                  lastMessagePreview: summarizeMessage(message),
                }
              : conversation,
          );
          return {
            messagesByConversation: {
              ...state.messagesByConversation,
              [message.conversationId]: nextMessages,
            },
            conversations: sortConversations(nextConversations, {
              ...state.messagesByConversation,
              [message.conversationId]: nextMessages,
            }),
          };
        }),
      mergeMessages: (conversationId, messages) =>
        set((state) => {
          const current = state.messagesByConversation[conversationId] ?? [];
          const merged = [...current];
          messages.forEach((message) => {
            const index = merged.findIndex((candidate) => candidate.id === message.id);
            if (index === -1) {
              merged.push(message);
            }
          });
          return {
            messagesByConversation: {
              ...state.messagesByConversation,
              [conversationId]: merged.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              ),
            },
          };
        }),
      updateMessageStatus: ({ conversationId, messageId, status, userId }) =>
        set((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((message) =>
              message.id !== messageId
                ? message
                : {
                    ...message,
                    status,
                    deliveredTo:
                      status === "delivered"
                        ? Array.from(new Set([...(message.deliveredTo ?? []), userId]))
                        : message.deliveredTo,
                    seenBy:
                      status === "seen"
                        ? Array.from(new Set([...(message.seenBy ?? []), userId]))
                        : message.seenBy,
                  },
            ),
          },
        })),
      toggleReaction: (payload) =>
        set((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [payload.conversationId]: (state.messagesByConversation[payload.conversationId] ?? []).map(
              (message) => {
                if (message.id !== payload.messageId) {
                  return message;
                }

                const reactions = [...(message.reactions ?? [])];
                const index = reactions.findIndex((reaction) => reaction.emoji === payload.emoji);
                if (index === -1) {
                  reactions.push({ emoji: payload.emoji, userIds: [payload.userId] });
                  return { ...message, reactions };
                }

                const current = reactions[index];
                const nextUsers = current.userIds.includes(payload.userId)
                  ? current.userIds.filter((id) => id !== payload.userId)
                  : [...current.userIds, payload.userId];
                reactions[index] = { ...current, userIds: nextUsers };
                return {
                  ...message,
                  reactions: reactions.filter((reaction) => reaction.userIds.length),
                };
              },
            ),
          },
        })),
      deleteMessage: (payload) =>
        set((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [payload.conversationId]: payload.everyone
              ? (state.messagesByConversation[payload.conversationId] ?? []).map((message) =>
                  message.id !== payload.messageId
                    ? message
                    : {
                        ...message,
                        body: "Message removed",
                        deletedForEveryone: true,
                        status: "deleted",
                      },
                )
              : (state.messagesByConversation[payload.conversationId] ?? []).filter(
                  (message) => message.id !== payload.messageId,
                ),
          },
        })),
      setReplyTo: (replyTo) => set({ replyTo }),
      setSocketConnected: (socketConnected) => set({ socketConnected }),
      openLightbox: (lightbox) => set({ lightbox }),
      closeLightbox: () => set({ lightbox: undefined }),
      upsertConversation: (conversation) =>
        set((state) => ({
          conversations: sortConversations(
            upsertById(state.conversations, conversation),
            state.messagesByConversation,
          ),
        })),
      upsertRoom: (room) =>
        set((state) => ({
          rooms: upsertById(state.rooms, room),
        })),
      upsertRoomParticipants: (roomId, participants) =>
        set((state) => ({
          rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, participants } : room)),
        })),
      setSecretPin: (secretPin) => set({ secretPin, secretUnlocked: true }),
      unlockSecret: (pin) => {
        const valid = get().secretPin === pin;
        if (valid) {
          set({ secretUnlocked: true });
        }
        return valid;
      },
      lockSecret: () => set({ secretUnlocked: false }),
      showSecretWarning: (secretWarningVisible) => set({ secretWarningVisible }),
      createSecretConversation: (title, participantIds) => {
        const conversation: Conversation = {
          id: createEntityId("secret"),
          kind: "secret",
          title,
          participantIds,
          hidden: true,
          secretLocked: true,
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          conversations: sortConversations(
            [conversation, ...state.conversations],
            state.messagesByConversation,
          ),
        }));
        return conversation;
      },
      createOutgoingMessage: ({ conversation, body, attachments, replyToId, selfDestructSeconds }) => {
        const session = get().session;
        const secretPin = get().secretPin;
        const createdAt = new Date().toISOString();
        const outgoingBody =
          conversation.kind === "secret" && secretPin
            ? JSON.stringify(encryptSecretText(body, secretPin))
            : body;

        const firstAttachmentKind = attachments?.[0]?.kind;
        return {
          id: createEntityId("msg"),
          conversationId: conversation.id,
          kind: conversation.kind,
          type:
            firstAttachmentKind === "voice"
              ? "voice"
              : firstAttachmentKind === "image"
                ? "image"
                : firstAttachmentKind === "video"
                  ? "video"
                  : firstAttachmentKind === "document"
                    ? "document"
                    : body.trim().length <= 3
                      ? "emoji"
                      : "text",
          senderId: session!.user.id,
          body: outgoingBody,
          createdAt,
          replyToId,
          attachments,
          status: "sent",
          isSecret: conversation.kind === "secret",
          selfDestructSeconds,
          destructAt:
            selfDestructSeconds && conversation.kind === "secret"
              ? new Date(Date.now() + selfDestructSeconds * 1000).toISOString()
              : undefined,
        };
      },
      readSecretMessage: (conversationId, messageId) => {
        const message = (get().messagesByConversation[conversationId] ?? []).find(
          (item) => item.id === messageId,
        );
        const pin = get().secretPin;
        if (!message || !pin) {
          return "";
        }
        try {
          return decryptSecretText(JSON.parse(message.body), pin);
        } catch {
          return "[Unable to decrypt. Confirm both devices share the same secret PIN.]";
        }
      },
    }),
    {
      name: "frostchat-web-store-v2",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        session: state.session,
        users: state.users,
        conversations: state.conversations,
        rooms: state.rooms,
        messagesByConversation: state.messagesByConversation,
        activeConversationId: state.activeConversationId,
        secretPin: state.secretPin,
      }),
    },
  ),
);
