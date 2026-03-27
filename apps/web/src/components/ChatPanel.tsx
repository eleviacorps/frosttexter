import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  CheckCheck,
  Copy,
  FileText,
  ImageIcon,
  LockKeyhole,
  MoreHorizontal,
  Phone,
  Reply,
  Trash2,
  Users,
  Video,
} from "lucide-react";

import type { ChatMessage, Conversation } from "@frostchat/shared";
import { groupMessagesByDate } from "@frostchat/shared";

import {
  emitMessage,
  emitReaction,
  emitStatus,
  emitTyping,
  joinConversation,
} from "@/lib/socket";
import { useAppStore } from "@/store/useAppStore";

import { FrostPanel } from "./FrostPanel";
import { MessageComposer } from "./MessageComposer";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function MessageBubble({ message, conversation }: { message: ChatMessage; conversation: Conversation }) {
  const session = useAppStore((state) => state.session)!;
  const users = useAppStore((state) => state.users);
  const setReplyTo = useAppStore((state) => state.setReplyTo);
  const openLightbox = useAppStore((state) => state.openLightbox);
  const readSecretMessage = useAppStore((state) => state.readSecretMessage);
  const deleteMessage = useAppStore((state) => state.deleteMessage);
  const outgoing = message.senderId === session.user.id;
  const decryptedBody =
    conversation.kind === "secret" ? readSecretMessage(conversation.id, message.id) : message.body;
  const sender = users.find((user) => user.id === message.senderId)?.username ?? "Friend";
  const [menuOpen, setMenuOpen] = useState(false);
  const [customReaction, setCustomReaction] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  function addReaction(emoji: string) {
    if (!emoji.trim()) {
      return;
    }

    emitReaction({
      conversationId: message.conversationId,
      emoji: emoji.trim(),
      messageId: message.id,
      userId: session.user.id,
    });
    setCustomReaction("");
    setMenuOpen(false);
  }

  function handleDeleteForSelf() {
    deleteMessage({
      conversationId: message.conversationId,
      messageId: message.id,
      deletedBy: session.user.id,
      everyone: false,
    });
    setMenuOpen(false);
  }

  return (
    <div
      className={clsx("flex gap-3", outgoing ? "justify-end" : "justify-start")}
      onTouchStart={(event) => {
        const touch = event.changedTouches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const start = touchStartRef.current;
        const touch = event.changedTouches[0];
        if (!start || !touch) {
          return;
        }

        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;
        if (Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY)) {
          setReplyTo(message);
        }
        touchStartRef.current = null;
      }}
    >
      {!outgoing ? (
        <div className="hidden h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#17191d] text-[11px] font-semibold text-white/72 sm:grid">
          {initials(sender)}
        </div>
      ) : null}

      <div className={clsx("max-w-[min(82%,720px)]", outgoing ? "items-end" : "items-start")}>
        {!outgoing && conversation.kind === "group" ? (
          <p className="mb-1.5 px-1 text-[11px] uppercase tracking-[0.24em] text-white/34">{sender}</p>
        ) : null}

        <div
          className={clsx(
            "relative rounded-[22px] border px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)]",
            outgoing
              ? "border-[#24304b] bg-[linear-gradient(180deg,rgba(28,34,24,0.96),rgba(19,22,18,0.96))]"
              : "border-[#1a2336] bg-[#121317]",
          )}
        >
          <div ref={menuRef} className="absolute right-2 top-2 z-10">
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="grid h-8 w-8 place-items-center rounded-xl border border-[#1a2336] bg-black/18 text-white/56 transition hover:border-[#24304b] hover:text-white"
            >
              <MoreHorizontal size={13} />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-10 w-56 rounded-[20px] border border-[#1a2336] bg-[#0f1115] p-2 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(message);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-white/76 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <Reply size={14} />
                  Reply
                </button>

                <div className="mt-1 rounded-2xl bg-black/16 p-2">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-white/28">
                    React
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["👍", "❤️", "🔥", "😂", "❄️"].map((emoji) => (
                      <button
                        key={`${message.id}-${emoji}`}
                        type="button"
                        onClick={() => addReaction(emoji)}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-[#1a2336] bg-[#14171d] text-base"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={customReaction}
                      onChange={(event) => setCustomReaction(event.target.value)}
                      placeholder="Any emoji"
                      className="min-w-0 flex-1 rounded-xl border border-[#1a2336] bg-[#14171d] px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
                    />
                    <button
                      type="button"
                      onClick={() => addReaction(customReaction)}
                      className="rounded-xl bg-[#d5f575] px-3 text-xs font-medium text-black"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(decryptedBody || "");
                    setMenuOpen(false);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-white/76 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <Copy size={14} />
                  Copy text
                </button>

                <button
                  type="button"
                  onClick={handleDeleteForSelf}
                  className="mt-1 flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-rose-100/88 transition hover:bg-rose-500/10"
                >
                  <Trash2 size={14} />
                  Delete for me
                </button>
              </div>
            ) : null}
          </div>

          {message.replyToId ? (
            <p className="mb-3 rounded-2xl border border-[#1a2336] bg-black/18 px-3 py-2 pr-10 text-xs text-white/50">
              Reply attached
            </p>
          ) : null}

          <div className="space-y-2.5 pr-10">
            {message.attachments?.map((attachment) => (
              <div key={attachment.id}>
                {attachment.kind === "image" ? (
                  <button
                    type="button"
                    onClick={() => openLightbox(attachment)}
                    className="overflow-hidden rounded-[18px]"
                  >
                    <img src={attachment.url} alt={attachment.name} className="max-h-72 w-full object-cover" />
                  </button>
                ) : attachment.kind === "video" ? (
                  <video controls className="max-h-72 w-full rounded-[18px] bg-black">
                    <source src={attachment.url} />
                  </video>
                ) : attachment.kind === "voice" ? (
                  <div className="rounded-[18px] border border-[#1a2336] bg-black/20 px-3 py-3">
                    <div className="mb-2 flex h-8 items-end gap-1">
                      {(attachment.waveform ?? []).map((value, index) => (
                        <span
                          key={`${attachment.id}-${index}`}
                          className="w-1 rounded-full bg-[#d5f575]/75"
                          style={{ height: `${Math.max(8, value * 30)}px` }}
                        />
                      ))}
                    </div>
                    <audio controls className="w-full">
                      <source src={attachment.url} />
                    </audio>
                  </div>
                ) : (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-[18px] border border-[#1a2336] bg-black/18 px-3 py-3 text-sm text-white/82 transition hover:border-[#24304b] hover:text-white"
                  >
                    <FileText size={16} className="text-white/42" />
                    {attachment.name}
                  </a>
                )}
              </div>
            ))}

            {decryptedBody ? <p className="whitespace-pre-wrap text-sm leading-6 text-white/92">{decryptedBody}</p> : null}
          </div>

          {message.reactions?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.reactions.map((reaction) => (
                <button
                  key={`${message.id}-${reaction.emoji}`}
                  type="button"
                  onClick={() =>
                    emitReaction({
                      conversationId: message.conversationId,
                      emoji: reaction.emoji,
                      messageId: message.id,
                      userId: session.user.id,
                    })
                  }
                  className="rounded-full border border-[#1a2336] bg-black/18 px-2.5 py-1 text-xs text-white/82"
                >
                  {reaction.emoji} {reaction.userIds.length}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-4 text-[11px] text-white/42">
            <div className="flex items-center gap-2">
              <span>
                {new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(
                  new Date(message.createdAt),
                )}
              </span>
              {outgoing ? (
                <span className="inline-flex items-center gap-1 text-[#dce9a6]">
                  <CheckCheck size={12} />
                  {message.status}
                </span>
              ) : null}
              {message.selfDestructSeconds ? <LockKeyhole size={12} className="text-amber-200/78" /> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailsPane({
  conversation,
  messages,
}: {
  conversation: Conversation;
  messages: ChatMessage[];
}) {
  const users = useAppStore((state) => state.users);
  const session = useAppStore((state) => state.session);

  const participants = conversation.participantIds
    .map((id) => users.find((user) => user.id === id))
    .filter((user): user is NonNullable<typeof user> => Boolean(user));

  const sharedAttachments = messages
    .flatMap((message) => message.attachments ?? [])
    .slice(0, 6);

  return (
    <aside className="flex h-full w-full flex-col">
      <div className="border-b border-[#182033] px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#17191d] text-sm font-semibold text-white/82">
            {initials(conversation.title)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{conversation.title}</p>
            <p className="mt-1 text-xs text-white/38">
              {conversation.kind === "group"
                ? `${participants.length} members`
                : conversation.kind === "secret"
                  ? "Private local thread"
                  : "Direct message"}
            </p>
          </div>
        </div>
      </div>

      <div className="hide-scrollbar flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <section className="rounded-[24px] border border-[#1a2336] bg-[#111215] p-4">
          <div className="mb-4 flex items-center gap-2">
            <Users size={15} className="text-white/42" />
            <p className="text-sm font-medium text-white">Members</p>
          </div>
          <div className="space-y-3">
            {participants.map((user) => (
              <div key={user.id} className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#17191d] text-xs font-medium text-white/75">
                  {initials(user.username)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/88">{user.username}</p>
                  <p className="text-xs text-white/38">
                    {user.id === session?.user.id ? "You" : "Member"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#1a2336] bg-[#111215] p-4">
          <div className="mb-4 flex items-center gap-2">
            <ImageIcon size={15} className="text-white/42" />
            <p className="text-sm font-medium text-white">Shared files</p>
          </div>
          {sharedAttachments.length ? (
            <div className="grid grid-cols-2 gap-2">
              {sharedAttachments.map((attachment) =>
                attachment.kind === "image" ? (
                  <img
                    key={attachment.id}
                    src={attachment.url}
                    alt={attachment.name}
                    className="aspect-square rounded-2xl object-cover"
                  />
                ) : (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-[88px] flex-col justify-between rounded-2xl border border-[#1a2336] bg-[#17191d] p-3 text-xs text-white/68"
                  >
                    <FileText size={14} className="text-white/42" />
                    <span className="line-clamp-2">{attachment.name}</span>
                  </a>
                ),
              )}
            </div>
          ) : (
            <p className="text-sm leading-6 text-white/42">
              Shared photos, docs, and voice notes will appear here.
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}

export function ChatPanel({ conversation }: { conversation?: Conversation }) {
  const selectedConversation = conversation;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const session = useAppStore((state) => state.session);
  const users = useAppStore((state) => state.users);
  const messagesByConversation = useAppStore((state) => state.messagesByConversation);
  const typingByConversation = useAppStore((state) => state.typingByConversation);
  const addMessage = useAppStore((state) => state.addMessage);
  const createOutgoingMessage = useAppStore((state) => state.createOutgoingMessage);
  const onlineUserIds = useAppStore((state) => state.onlineUserIds);
  const updateMessageStatus = useAppStore((state) => state.updateMessageStatus);

  const messages = useMemo(
    () => (selectedConversation ? messagesByConversation[selectedConversation.id] ?? [] : []),
    [messagesByConversation, selectedConversation],
  );
  const typing = useMemo(
    () => (selectedConversation ? typingByConversation[selectedConversation.id] ?? [] : []),
    [selectedConversation, typingByConversation],
  );

  useEffect(() => {
    if (conversation) {
      joinConversation(conversation.id);
    }
  }, [conversation]);

  useEffect(() => {
    setDetailsOpen(false);
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation || !session) {
      return;
    }

    const unseenMessages = messages.filter(
      (message) =>
        message.senderId !== session.user.id &&
        message.status !== "seen" &&
        !(message.seenBy ?? []).includes(session.user.id),
    );

    if (!unseenMessages.length) {
      return;
    }

    unseenMessages.forEach((message) => {
      const targetUserIds = conversation.participantIds.filter((id) => id !== session.user.id);
      emitStatus({
        conversationId: conversation.id,
        messageId: message.id,
        status: "seen",
        userId: session.user.id,
        targetUserIds,
      });
      updateMessageStatus({
        conversationId: conversation.id,
        messageId: message.id,
        status: "seen",
        userId: session.user.id,
      });
    });
  }, [conversation, messages, session, updateMessageStatus]);

  const groupedMessages = useMemo(() => groupMessagesByDate([...messages].reverse()), [messages]);

  if (!conversation) {
    return (
      <FrostPanel className="flex h-full items-center justify-center bg-[rgba(8,8,10,0.86)] p-8">
        <div className="max-w-md text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/28">No conversation selected</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Your inbox is ready</h2>
          <p className="mt-3 text-sm leading-6 text-white/48">
            Open this on another device or create a second account with the same invite code to
            start a private conversation.
          </p>
        </div>
      </FrostPanel>
    );
  }

  const typingNames = typing
    .filter((userId) => userId !== session?.user.id)
    .map((userId) => users.find((user) => user.id === userId)?.username ?? "Someone");
  const dmOtherId = conversation.participantIds.find((id) => id !== session?.user.id);
  const isOnline = dmOtherId ? onlineUserIds.includes(dmOtherId) : false;

  async function handleSend({
    body,
    attachments,
    selfDestructSeconds,
  }: {
    body: string;
    attachments?: ChatMessage["attachments"];
    selfDestructSeconds?: number;
  }) {
    if (!session) {
      return;
    }

    const message = createOutgoingMessage({
      conversation: selectedConversation!,
      body,
      attachments,
      replyToId: useAppStore.getState().replyTo?.id,
      selfDestructSeconds,
    });
    addMessage(message);
    emitMessage({
      message,
      targetUserIds: selectedConversation!.participantIds.filter((id) => id !== session.user.id),
    });
  }

  return (
    <div className="relative flex h-full min-h-0 bg-transparent">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[84px] items-center justify-between border-b border-[#182033] px-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#17191d] text-sm font-semibold text-white/82">
                {initials(conversation.title)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight text-white">
                  {conversation.title}
                </p>
                <p className="mt-0.5 text-sm text-white/40">
                  {conversation.kind === "group"
                    ? `${conversation.participantIds.length} members`
                    : isOnline
                      ? "Online now"
                      : "Offline"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {conversation.kind === "secret" ? (
              <div className="hidden rounded-full border border-[#d5f575]/18 bg-[#d5f575]/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.24em] text-[#eef7c2] sm:block">
                Secret
              </div>
            ) : null}
            {[Phone, Video, MoreHorizontal].map((Icon, index) => (
              <button
                key={`${conversation.id}-${index}`}
                type="button"
                onClick={
                  Icon === MoreHorizontal ? () => setDetailsOpen((current) => !current) : undefined
                }
                className="grid h-10 w-10 place-items-center rounded-2xl border border-[#1a2336] bg-[#111215] text-white/62 transition hover:border-[#24304b] hover:text-white"
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1">
          <div className="hide-scrollbar flex h-full flex-col gap-6 overflow-y-auto px-4 py-5 sm:px-6">
            {Object.entries(groupedMessages).map(([date, items]) => (
              <div key={date}>
                <div className="mb-5 text-center text-[11px] uppercase tracking-[0.34em] text-white/24">
                  {date}
                </div>
                <div className="space-y-4">
                  {items.map((message) => (
                    <MessageBubble key={message.id} message={message} conversation={conversation} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {typingNames.length ? (
          <p className="px-4 pb-2 text-sm text-[#dce9a6] sm:px-6">{typingNames.join(", ")} typing...</p>
        ) : null}

        <MessageComposer
          conversation={conversation}
          onTyping={(active) =>
            emitTyping(
              {
                conversationId: conversation.id,
                kind: selectedConversation!.kind,
                userId: session!.user.id,
              },
              active,
            )
          }
          onSend={handleSend}
        />
      </div>

      {detailsOpen ? (
        <>
          <button
            type="button"
            aria-label="Close details"
            onClick={() => setDetailsOpen(false)}
            className="absolute inset-0 z-10 bg-black/35 backdrop-blur-[1px]"
          />
          <div className="absolute inset-y-0 right-0 z-20 w-full max-w-[340px] border-l border-[#182033] bg-[#0c0d10] shadow-[-24px_0_48px_rgba(0,0,0,0.38)]">
            <DetailsPane conversation={conversation} messages={messages} />
          </div>
        </>
      ) : null}
    </div>
  );
}
