import type { AuthSession, ChatMessage, DeleteEvent, MessageRelayEvent, ReactionEvent, TypingPayload } from "@frostchat/shared";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "./supabase";

let presenceChannel: RealtimeChannel | null = null;
const conversationChannels = new Map<string, RealtimeChannel>();

function channelName(id: string) {
  return `frostchat:conversation:${id}`;
}

function teardown() {
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }
  conversationChannels.forEach((channel) => supabase.removeChannel(channel));
  conversationChannels.clear();
}

function ensureConversationChannel(
  conversationId: string,
  handlers: Parameters<typeof connectMobileSocket>[1],
) {
  if (conversationChannels.has(conversationId)) {
    return;
  }

  const channel = supabase.channel(channelName(conversationId), {
    config: { broadcast: { self: true } },
  });

  channel
    .on("broadcast", { event: "message:new" }, ({ payload }) => handlers.onMessage(payload as ChatMessage))
    .on("broadcast", { event: "message:status" }, ({ payload }) =>
      handlers.onMessageStatus(
        payload as {
          conversationId: string;
          messageId: string;
          status: ChatMessage["status"];
          userId: string;
        },
      ),
    )
    .on("broadcast", { event: "message:react" }, ({ payload }) => handlers.onReaction(payload as ReactionEvent))
    .on("broadcast", { event: "message:delete" }, ({ payload }) => handlers.onDelete(payload as DeleteEvent))
    .on("broadcast", { event: "typing:update" }, ({ payload }) => handlers.onTyping(payload as TypingPayload, true))
    .on("broadcast", { event: "typing:clear" }, ({ payload }) => handlers.onTyping(payload as TypingPayload, false))
    .subscribe();

  conversationChannels.set(conversationId, channel);
}

export function connectMobileSocket(
  session: AuthSession,
  handlers: {
    onConnect: () => void;
    onDisconnect: () => void;
    onPresence: (userIds: string[]) => void;
    onMessage: (message: ChatMessage) => void;
    onMessageStatus: (payload: {
      conversationId: string;
      messageId: string;
      status: ChatMessage["status"];
      userId: string;
    }) => void;
    onReaction: (payload: ReactionEvent) => void;
    onDelete: (payload: DeleteEvent) => void;
    onTyping: (payload: TypingPayload, active: boolean) => void;
    onCache: (messages: ChatMessage[]) => void;
  },
  options?: { conversationIds?: string[] },
) {
  teardown();
  void (async () => {
    if (session.refreshToken) {
      await supabase.auth.setSession({
        access_token: session.token,
        refresh_token: session.refreshToken,
      });
    }

    presenceChannel = supabase.channel("frostchat:presence:mobile", {
      config: { presence: { key: session.user.id } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const userIds = (Object.values(presenceChannel!.presenceState<Record<string, unknown>[]>()).flat() as unknown as Array<Record<string, unknown>>)
          .map((item) => String(item.userId))
          .filter(Boolean);
        handlers.onPresence(userIds);
      })
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

    (options?.conversationIds ?? []).forEach((conversationId) =>
      ensureConversationChannel(conversationId, handlers),
    );
    handlers.onCache([]);
  })();
}

export function joinConversation(conversationId: string) {
  const channel = conversationChannels.get(conversationId);
  if (!channel) {
    return;
  }
  channel.subscribe();
}

export function emitMessage(payload: MessageRelayEvent) {
  const channel = conversationChannels.get(payload.message.conversationId);
  if (!channel) {
    return;
  }
  void channel.send({
    type: "broadcast",
    event: "message:new",
    payload: payload.message,
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
