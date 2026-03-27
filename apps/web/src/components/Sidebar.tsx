import { useMemo } from "react";
import clsx from "clsx";
import {
  LockKeyhole,
  LogOut,
  MessageSquareMore,
  Plus,
  Search,
  Users,
  Waves,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { getConversationTitle } from "@frostchat/shared";

import { useAppStore } from "@/store/useAppStore";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Sidebar({ onCreateGroup }: { onCreateGroup: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    session,
    users,
    conversations,
    messagesByConversation,
    activeConversationId,
    onlineUserIds,
    setActiveConversation,
    logout,
  } = useAppStore(
    useShallow((state) => ({
      session: state.session,
      users: state.users,
      conversations: state.conversations,
      messagesByConversation: state.messagesByConversation,
      activeConversationId: state.activeConversationId,
      onlineUserIds: state.onlineUserIds,
      setActiveConversation: state.setActiveConversation,
      logout: state.logout,
    })),
  );

  const visibleConversations = useMemo(
    () => conversations.filter((conversation) => !conversation.hidden),
    [conversations],
  );

  return (
    <div className="flex h-full min-h-0 bg-transparent">
      <div className="surface-divider flex w-[76px] shrink-0 flex-col items-center justify-between px-3 py-5">
        <div className="flex w-full flex-col items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#d5f575] text-sm font-semibold text-black">
            F
          </div>
          {[
            { to: "/chat", icon: MessageSquareMore, label: "Chats" },
            { to: "/rooms", icon: Waves, label: "Rooms" },
            { to: "/secret", icon: LockKeyhole, label: "Secret" },
          ].map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  "grid h-12 w-12 place-items-center rounded-2xl border text-white/60 transition",
                  active
                    ? "border-[#24304b] bg-[#d5f575]/12 text-[#eff8bb]"
                    : "border-[#1a2336] bg-white/[0.02] hover:border-[#24304b] hover:bg-white/[0.05] hover:text-white",
                )}
                title={item.label}
              >
                <item.icon size={18} />
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onCreateGroup}
          className="grid h-12 w-12 place-items-center rounded-2xl border border-[#1a2336] bg-white/[0.03] text-white/78 transition hover:border-[#24304b] hover:bg-white/[0.06] hover:text-white"
          title="Create group"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col px-5 py-5">
        <div className="flex items-center justify-between gap-3 pb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/32">FrostChat</p>
            <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-white">Inbox</h2>
          </div>
          <div className="rounded-full border border-[#1a2336] px-3 py-1 text-xs text-white/50">
            {onlineUserIds.length} online
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-[#1a2336] bg-[#111214] px-3 py-3 text-sm text-white/42">
          <Search size={16} className="text-white/32" />
          Search conversations
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.28em] text-white/30">Recent chats</p>
          <button
            type="button"
            onClick={onCreateGroup}
            className="text-xs font-medium text-[#dce9a6] transition hover:text-white"
          >
            New group
          </button>
        </div>

        <div className="hide-scrollbar mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
          {visibleConversations.map((conversation) => {
            const preview = messagesByConversation[conversation.id]?.[0];
            const title = getConversationTitle(conversation, users, session!.user.id);
            const dmOtherId = conversation.participantIds.find((id) => id !== session!.user.id);
            const isOnline = dmOtherId ? onlineUserIds.includes(dmOtherId) : false;

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setActiveConversation(conversation.id);
                  navigate(`/chat/${conversation.id}`);
                }}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition",
                  activeConversationId === conversation.id
                    ? "border-[#24304b] bg-[#151619]"
                    : "border-transparent bg-transparent hover:border-[#1a2336] hover:bg-[#101113]",
                )}
              >
                <div className="relative shrink-0">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#191b1f] text-sm font-medium text-white/88">
                    {initials(title)}
                  </div>
                  {conversation.kind === "dm" ? (
                    <span
                      className={clsx(
                        "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0b0c0f]",
                        isOnline ? "bg-emerald-400" : "bg-white/12",
                      )}
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-medium text-white">{title}</p>
                    {conversation.kind === "group" ? (
                      <Users size={14} className="shrink-0 text-white/35" />
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-white/42">
                    {preview?.deletedForEveryone
                      ? "Message removed"
                      : preview?.body || conversation.lastMessagePreview || "No messages yet"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-[24px] border border-[#1a2336] bg-[#101114] px-3 py-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#191b1f] text-sm font-medium text-white">
            {initials(session?.user.username ?? "Me")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{session?.user.username}</p>
            <p className="text-xs text-white/40">Invite-only account</p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-[#1a2336] bg-white/[0.03] text-white/72 transition hover:border-[#24304b] hover:bg-white/[0.06] hover:text-white"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
