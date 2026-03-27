import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Camera,
  LockKeyhole,
  LogOut,
  MessageSquareMore,
  PencilLine,
  Plus,
  Search,
  Users,
  Waves,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { getConversationTitle } from "@frostchat/shared";

import { api } from "@/lib/api";
import { uploadAttachment } from "@/lib/media";
import { useAppStore } from "@/store/useAppStore";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AvatarBadge({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string;
  size?: "sm" | "md";
}) {
  const classes = size === "sm" ? "h-10 w-10 rounded-2xl text-xs" : "h-12 w-12 rounded-2xl text-sm";

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${classes} object-cover`} />;
  }

  return (
    <div className={`grid ${classes} place-items-center bg-[#191b1f] font-medium text-white/88`}>
      {initials(name)}
    </div>
  );
}

function AccountDetailsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const session = useAppStore((state) => state.session);
  const uploadConfig = useAppStore((state) => state.uploadConfig);
  const hydrate = useAppStore((state) => state.hydrate);
  const [username, setUsername] = useState(session?.user.username ?? "");
  const [status, setStatus] = useState(session?.user.status ?? "");
  const [avatarUrl, setAvatarUrl] = useState(session?.user.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!session) {
      return;
    }

    setUsername(session.user.username);
    setStatus(session.user.status ?? "");
    setAvatarUrl(session.user.avatarUrl ?? "");
    setError(undefined);
  }, [open, session?.user.avatarUrl, session?.user.status, session?.user.username]);

  if (!open || !session) {
    return null;
  }

  async function handleAvatarUpload(file?: File) {
    if (!file) {
      return;
    }

    setSaving(true);
    setError(undefined);
    try {
      const attachment = await uploadAttachment(file, file.name, uploadConfig ?? { bucket: "attachments" });
      setAvatarUrl(attachment.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload avatar");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!session) {
      return;
    }

    try {
      setSaving(true);
      setError(undefined);
      await api.updateProfile(session, {
        username: username.trim(),
        status: status.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });
      const bootstrap = await api.me(session.token, session.refreshToken);
      hydrate(bootstrap);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-[#182033] bg-[rgba(10,10,12,0.96)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/32">Profile</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">Edit account details</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#1a2336] bg-white/[0.04] px-4 py-2 text-sm text-white/72"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-[24px] border border-[#1a2336] bg-[#111215] p-4">
          <AvatarBadge name={username || session.user.username} avatarUrl={avatarUrl || undefined} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">{username || session.user.username}</p>
            <p className="mt-1 text-xs text-white/42">{status || "No status set yet"}</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[#1a2336] bg-white/[0.04] px-3 py-2 text-xs text-white/78">
            <Camera size={14} />
            Upload
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(event) => void handleAvatarUpload(event.target.files?.[0])}
            />
          </label>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-sm text-white/70">
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#1a2336] bg-[#111215] px-4 py-3 text-white outline-none"
            />
          </label>

          <label className="block text-sm text-white/70">
            Status
            <input
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              placeholder="Building something calm."
              className="mt-2 w-full rounded-2xl border border-[#1a2336] bg-[#111215] px-4 py-3 text-white outline-none"
            />
          </label>

          <label className="block text-sm text-white/70">
            Avatar URL
            <input
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://..."
              className="mt-2 w-full rounded-2xl border border-[#1a2336] bg-[#111215] px-4 py-3 text-white outline-none"
            />
          </label>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#1a2336] bg-white/[0.04] px-4 py-3 text-sm text-white/72"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !username.trim()}
            onClick={() => void handleSave()}
            className="rounded-2xl bg-[#d5f575] px-4 py-3 text-sm font-medium text-black disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ onCreateGroup }: { onCreateGroup: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
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
            const avatarUser = conversation.kind === "dm"
              ? users.find((user) => user.id === dmOtherId)
              : undefined;
            const avatarUrl = conversation.kind === "group" ? conversation.avatarUrl : avatarUser?.avatarUrl;

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
                  <AvatarBadge name={title} avatarUrl={avatarUrl} />
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

        <button
          type="button"
          onClick={() => setAccountDialogOpen(true)}
          className="mt-4 flex w-full items-center gap-3 rounded-[24px] border border-[#1a2336] bg-[#101114] px-3 py-3 text-left transition hover:border-[#24304b]"
        >
          <AvatarBadge
            name={session?.user.username ?? "Me"}
            avatarUrl={session?.user.avatarUrl}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{session?.user.username}</p>
            <p className="truncate text-xs text-white/40">
              {session?.user.status || "Invite-only account"}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-2xl border border-[#1a2336] bg-white/[0.03] px-3 py-2 text-xs text-white/72">
            <PencilLine size={14} />
            Edit
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setAccountDialogOpen(false);
              logout();
              navigate("/login");
            }}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-[#1a2336] bg-white/[0.03] text-white/72 transition hover:border-[#24304b] hover:bg-white/[0.06] hover:text-white"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </button>

        <AccountDetailsDialog open={accountDialogOpen} onClose={() => setAccountDialogOpen(false)} />
      </div>
    </div>
  );
}
