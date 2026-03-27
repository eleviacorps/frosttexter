import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AuthSession, BootstrapPayload, ChatKind, ChatMessage, Conversation, DeleteEvent, LiveRoom, ReactionEvent } from "@frostchat/shared";
import { createEntityId, decryptSecretText, encryptSecretText, upsertById } from "@frostchat/shared";

interface MobileState {
  session?: AuthSession;
  users: BootstrapPayload["users"];
  conversations: Conversation[];
  rooms: LiveRoom[];
  messagesByConversation: Record<string, ChatMessage[]>;
  activeTab: "chat" | "rooms" | "secret";
  activeConversationId?: string;
  onlineUserIds: string[];
  secretPin?: string;
  secretUnlocked: boolean;
  hydrate: (payload: BootstrapPayload) => void;
  logout: () => void;
  addMessage: (message: ChatMessage) => void;
  mergeMessages: (conversationId: string, messages: ChatMessage[]) => void;
  setOnlineUsers: (userIds: string[]) => void;
  setActiveTab: (tab: MobileState["activeTab"]) => void;
  setActiveConversation: (conversationId?: string) => void;
  upsertRoom: (room: LiveRoom) => void;
  updateMessageStatus: (payload: { conversationId: string; messageId: string; status: ChatMessage["status"]; userId: string }) => void;
  toggleReaction: (payload: ReactionEvent) => void;
  deleteMessage: (payload: DeleteEvent) => void;
  setSecretPin: (pin: string) => void;
  unlockSecret: (pin: string) => boolean;
  lockSecret: () => void;
  createSecretConversation: (title: string, participantIds: string[]) => Conversation;
  createOutgoingMessage: (input: {
    conversation: { id: string; kind: ChatKind };
    body: string;
    replyToId?: string;
    selfDestructSeconds?: number;
  }) => ChatMessage;
  readSecretMessage: (conversationId: string, messageId: string) => string;
}

export const useMobileStore = create<MobileState>()(
  persist(
    (set, get) => ({
      users: [],
      conversations: [],
      rooms: [],
      messagesByConversation: {},
      activeTab: "chat",
      onlineUserIds: [],
      secretUnlocked: false,
      hydrate: (payload) =>
        set((state) => ({
          session: payload.session,
          users: payload.users,
          conversations: payload.conversations,
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
          secretUnlocked: false,
        }),
      addMessage: (message) =>
        set((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [message.conversationId]: upsertById(
              state.messagesByConversation[message.conversationId] ?? [],
              message,
            ).sort(
              (a: ChatMessage, b: ChatMessage) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          },
        })),
      mergeMessages: (conversationId, messages) =>
        set((state) => {
          const current = [...(state.messagesByConversation[conversationId] ?? [])];
          messages.forEach((message) => {
            if (!current.find((candidate) => candidate.id === message.id)) {
              current.push(message);
            }
          });
          return {
            messagesByConversation: {
              ...state.messagesByConversation,
              [conversationId]: current.sort(
                (a: ChatMessage, b: ChatMessage) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              ),
            },
          };
        }),
      setOnlineUsers: (onlineUserIds) => set({ onlineUserIds }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setActiveConversation: (activeConversationId) => set({ activeConversationId }),
      upsertRoom: (room) =>
        set((state) => ({
          rooms: upsertById(state.rooms, room),
        })),
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
            [payload.conversationId]: (state.messagesByConversation[payload.conversationId] ?? []).map((message) => {
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
              reactions[index] = {
                ...current,
                userIds: current.userIds.includes(payload.userId)
                  ? current.userIds.filter((id: string) => id !== payload.userId)
                  : [...current.userIds, payload.userId],
              };
              return { ...message, reactions };
            }),
          },
        })),
      deleteMessage: (payload) =>
        set((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [payload.conversationId]: (state.messagesByConversation[payload.conversationId] ?? []).map((message) =>
              message.id !== payload.messageId
                ? message
                : { ...message, status: "deleted", deletedForEveryone: payload.everyone, body: "Message removed" },
            ),
          },
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
        set((state) => ({ conversations: [conversation, ...state.conversations] }));
        return conversation;
      },
      createOutgoingMessage: ({ conversation, body, replyToId, selfDestructSeconds }) => {
        const session = get().session!;
        const secretPin = get().secretPin;
        return {
          id: createEntityId("msg"),
          conversationId: conversation.id,
          kind: conversation.kind,
          type: body.trim().length <= 3 ? "emoji" : "text",
          senderId: session.user.id,
          body:
            conversation.kind === "secret" && secretPin
              ? JSON.stringify(encryptSecretText(body, secretPin))
              : body,
          createdAt: new Date().toISOString(),
          status: "sent",
          replyToId,
          selfDestructSeconds,
        };
      },
      readSecretMessage: (conversationId, messageId) => {
        const message = (get().messagesByConversation[conversationId] ?? []).find((item) => item.id === messageId);
        const pin = get().secretPin;
        if (!message || !pin) {
          return "";
        }
        try {
          return decryptSecretText(JSON.parse(message.body), pin);
        } catch {
          return "[Unable to decrypt with current PIN]";
        }
      },
    }),
    {
      name: "frostchat-mobile-store",
      storage: createJSONStorage(() => AsyncStorage),
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
