import type {
  AuthSession,
  ChatMessage,
  DeleteEvent,
  MessageRelayEvent,
  ReactionEvent,
  TypingPayload,
} from "@frostchat/shared";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { api } from "./api";
import { supabase } from "./supabase";

type SocketHandlers = {
  onConnect: () => void;
  onDisconnect: () => void;
  onPresence: (userIds: string[]) => void;
  onMessage: (message: ChatMessage) => void;
  onMessageStatus: (payload: {
    conversationId: string;
    messageId: string;
    status: ChatMessage["status"];
    userId: string;
    targetUserIds: string[];
  }) => void;
  onReaction: (payload: ReactionEvent) => void;
  onDelete: (payload: DeleteEvent) => void;
  onTyping: (payload: TypingPayload, active: boolean) => void;
  onCache: (messages: ChatMessage[]) => void;
  onRoomParticipants: (
    roomId: string,
    participants: Array<{ userId: string; username?: string; joinedAt: string }>,
  ) => void;
  onRoomUpdated: (room: unknown) => void;
  onRoomEntry: (message: string) => void;
  onRoomKicked: (roomId: string) => void;
};

let currentSession: AuthSession | null = null;
let currentHandlers: SocketHandlers | null = null;
let presenceChannel: RealtimeChannel | null = null;
let activeRoomPresenceChannel: RealtimeChannel | null = null;
let activeRoomId: string | null = null;
const conversationChannels = new Map<string, RealtimeChannel>();
const roomChannels = new Map<string, RealtimeChannel>();

function channelName(prefix: string, id: string) {
  return `frostchat:${prefix}:${id}`;
}

function presenceToUsers(channel: RealtimeChannel) {
  const state = channel.presenceState<Record<string, unknown>[]>();
  return (Object.values(state).flat() as unknown as Array<Record<string, unknown>>)
    .map((item) => String(item.userId))
    .filter(Boolean);
}

function roomPresenceToParticipants(roomId: string, channel: RealtimeChannel) {
  const state = channel.presenceState<Record<string, unknown>[]>();
  return (Object.values(state).flat() as unknown as Array<Record<string, unknown>>)
    .map((item) => ({
      userId: String(item.userId),
      username: item.username ? String(item.username) : undefined,
      joinedAt: item.joinedAt ? String(item.joinedAt) : new Date().toISOString(),
    }))
    .filter((item) => item.userId && roomId);
}

function teardownChannels() {
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }
  if (activeRoomPresenceChannel) {
    supabase.removeChannel(activeRoomPresenceChannel);
    activeRoomPresenceChannel = null;
  }
  activeRoomId = null;
  conversationChannels.forEach((channel) => supabase.removeChannel(channel));
  roomChannels.forEach((channel) => supabase.removeChannel(channel));
  conversationChannels.clear();
  roomChannels.clear();
}

function ensureConversationChannel(conversationId: string) {
  if (!currentHandlers || conversationChannels.has(conversationId)) {
    return;
  }

  const channel = supabase.channel(channelName("conversation", conversationId), {
    config: { broadcast: { self: true } },
  });

  channel
    .on("broadcast", { event: "message:new" }, ({ payload }) => currentHandlers?.onMessage(payload as ChatMessage))
    .on("broadcast", { event: "message:status" }, ({ payload }) =>
      currentHandlers?.onMessageStatus(payload as SocketHandlers["onMessageStatus"] extends (arg: infer T) => void ? T : never),
    )
    .on("broadcast", { event: "message:react" }, ({ payload }) => currentHandlers?.onReaction(payload as ReactionEvent))
    .on("broadcast", { event: "message:delete" }, ({ payload }) => currentHandlers?.onDelete(payload as DeleteEvent))
    .on("broadcast", { event: "typing:update" }, ({ payload }) =>
      currentHandlers?.onTyping(payload as TypingPayload, true),
    )
    .on("broadcast", { event: "typing:clear" }, ({ payload }) =>
      currentHandlers?.onTyping(payload as TypingPayload, false),
    )
    .subscribe();

  conversationChannels.set(conversationId, channel);
}

function ensureRoomChannel(roomId: string) {
  if (!currentHandlers || roomChannels.has(roomId)) {
    return;
  }

  const channel = supabase.channel(channelName("room", roomId), {
    config: { broadcast: { self: true } },
  });

  channel
    .on("broadcast", { event: "message:new" }, ({ payload }) => currentHandlers?.onMessage(payload as ChatMessage))
    .on("broadcast", { event: "room:updated" }, ({ payload }) => currentHandlers?.onRoomUpdated(payload))
    .on("broadcast", { event: "room:entry" }, ({ payload }) =>
      currentHandlers?.onRoomEntry(String((payload as { message?: string }).message ?? "")),
    )
    .on("broadcast", { event: "room:kicked" }, ({ payload }) =>
      currentHandlers?.onRoomKicked(String((payload as { roomId?: string }).roomId ?? roomId)),
    )
    .subscribe();

  roomChannels.set(roomId, channel);
}

async function attachPresence(session: AuthSession, handlers: SocketHandlers) {
  presenceChannel = supabase.channel("frostchat:presence:global", {
    config: {
      presence: {
        key: session.user.id,
      },
    },
  });

  presenceChannel
    .on("presence", { event: "sync" }, () => handlers.onPresence(presenceToUsers(presenceChannel!)))
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        handlers.onConnect();
        await presenceChannel?.track({
          userId: session.user.id,
          username: session.user.username,
          joinedAt: new Date().toISOString(),
        });
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        handlers.onDisconnect();
      }
    });
}

export function getSocket() {
  return null;
}

export function connectSocket(
  session: AuthSession,
  handlers: SocketHandlers,
  options?: { conversationIds?: string[]; roomIds?: string[] },
) {
  currentSession = session;
  currentHandlers = handlers;
  teardownChannels();
  void (async () => {
    if (session.refreshToken) {
      await supabase.auth.setSession({
        access_token: session.token,
        refresh_token: session.refreshToken,
      });
    }

    await attachPresence(session, handlers);
    (options?.conversationIds ?? []).forEach(ensureConversationChannel);
    (options?.roomIds ?? []).forEach(ensureRoomChannel);
    handlers.onCache([]);
  })();
  return null;
}

export function joinConversation(conversationId: string) {
  ensureConversationChannel(conversationId);
}

export function emitMessage(payload: MessageRelayEvent) {
  const prefix = payload.message.kind === "room" ? "room" : "conversation";
  const channel = payload.message.kind === "room"
    ? roomChannels.get(payload.message.conversationId)
    : conversationChannels.get(payload.message.conversationId);
  const target = channel ?? supabase.channel(channelName(prefix, payload.message.conversationId), {
    config: { broadcast: { self: true } },
  });
  if (!channel) {
    target.subscribe();
    if (prefix === "room") {
      roomChannels.set(payload.message.conversationId, target);
    } else {
      conversationChannels.set(payload.message.conversationId, target);
    }
  }
  void target.send({
    type: "broadcast",
    event: "message:new",
    payload: payload.message,
  });
}

export function emitTyping(payload: TypingPayload, active: boolean) {
  const channel = conversationChannels.get(payload.conversationId);
  if (!channel) {
    return;
  }
  void channel.send({
    type: "broadcast",
    event: active ? "typing:update" : "typing:clear",
    payload,
  });
}

export function emitStatus(payload: {
  conversationId: string;
  messageId: string;
  status: ChatMessage["status"];
  userId: string;
  targetUserIds: string[];
}) {
  const channel = conversationChannels.get(payload.conversationId);
  if (!channel) {
    return;
  }
  void channel.send({
    type: "broadcast",
    event: "message:status",
    payload,
  });
}

export function emitReaction(payload: ReactionEvent) {
  const channel = conversationChannels.get(payload.conversationId);
  if (!channel) {
    return;
  }
  void channel.send({
    type: "broadcast",
    event: "message:react",
    payload,
  });
}

export function emitDelete(payload: DeleteEvent) {
  const channel = conversationChannels.get(payload.conversationId);
  if (!channel) {
    return;
  }
  void channel.send({
    type: "broadcast",
    event: "message:delete",
    payload,
  });
}

export function roomEmit(event: string, payload: unknown) {
  if (!currentSession || !currentHandlers) {
    return;
  }

  if (event === "room:join") {
    const roomId = String(payload);
    ensureRoomChannel(roomId);
    void api.joinRoom(currentSession, roomId);

    if (activeRoomPresenceChannel) {
      supabase.removeChannel(activeRoomPresenceChannel);
      activeRoomPresenceChannel = null;
    }
    activeRoomId = roomId;

    activeRoomPresenceChannel = supabase.channel(channelName("room-presence", roomId), {
      config: {
        presence: {
          key: currentSession.user.id,
        },
      },
    });

    activeRoomPresenceChannel
      .on("presence", { event: "sync" }, () => {
        currentHandlers?.onRoomParticipants(roomId, roomPresenceToParticipants(roomId, activeRoomPresenceChannel!));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await activeRoomPresenceChannel?.track({
            userId: currentSession!.user.id,
            username: currentSession!.user.username,
            joinedAt: new Date().toISOString(),
          });
          void roomChannels.get(roomId)?.send({
            type: "broadcast",
            event: "room:entry",
            payload: { message: `${currentSession!.user.username} joined the room` },
          });
        }
      });

    return;
  }

  if (event === "room:leave") {
    const roomId = String(payload);
    void api.leaveRoom(currentSession, roomId);
    void roomChannels.get(roomId)?.send({
      type: "broadcast",
      event: "room:entry",
      payload: { message: `${currentSession.user.username} left the room` },
    });
    if (activeRoomPresenceChannel && activeRoomId === roomId) {
      supabase.removeChannel(activeRoomPresenceChannel);
      activeRoomPresenceChannel = null;
      activeRoomId = null;
      currentHandlers.onRoomParticipants(roomId, []);
    }
    return;
  }

  if (event === "room:now-playing" || event === "room:mute") {
    const roomId = String((payload as { roomId?: string }).roomId ?? "");
    if (!roomId) {
      return;
    }
    void roomChannels.get(roomId)?.send({
      type: "broadcast",
      event: "room:updated",
      payload,
    });
  }
}
