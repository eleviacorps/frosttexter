import { useEffect, useMemo, useState } from "react";
import { Ban, Check, Search, Shield, UserPlus, UserRoundSearch, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { DiscoveryProfile } from "@frostchat/shared";

import { api } from "@/lib/api";
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
}: {
  name: string;
  avatarUrl?: string;
}) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-11 w-11 rounded-2xl object-cover" />;
  }

  return (
    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#191b1f] text-sm font-medium text-white/88">
      {initials(name)}
    </div>
  );
}

function relationshipLabel(profile: DiscoveryProfile) {
  switch (profile.relationship) {
    case "accepted":
      return "Connected";
    case "incoming_pending":
      return "Requested you";
    case "outgoing_pending":
      return "Request sent";
    case "blocked":
      return "Blocked";
    case "blocked_by":
      return "Unavailable";
    default:
      return "Not connected";
  }
}

function dmConversationId(userA: string, userB: string) {
  return ["dm", ...[userA, userB].sort()].join("_");
}

export function PeopleDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const session = useAppStore((state) => state.session);
  const hydrate = useAppStore((state) => state.hydrate);
  const setActiveConversation = useAppStore((state) => state.setActiveConversation);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workingUserId, setWorkingUserId] = useState<string>();
  const [error, setError] = useState<string>();
  const [results, setResults] = useState<DiscoveryProfile[]>([]);
  const [connections, setConnections] = useState<DiscoveryProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<DiscoveryProfile[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<DiscoveryProfile[]>([]);
  const [blockedProfiles, setBlockedProfiles] = useState<DiscoveryProfile[]>([]);

  const sections = useMemo(
    () => [
      { title: "Incoming requests", items: incomingRequests },
      { title: "Connections", items: connections },
      { title: "Sent requests", items: outgoingRequests },
      { title: "Blocked", items: blockedProfiles },
    ],
    [blockedProfiles, connections, incomingRequests, outgoingRequests],
  );

  async function refreshData() {
    if (!session) {
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      const [graph, bootstrap] = await Promise.all([
        api.socialGraph(session),
        api.me(session.token, session.refreshToken),
      ]);
      hydrate(bootstrap);
      setConnections(graph.connections);
      setIncomingRequests(graph.incomingRequests);
      setOutgoingRequests(graph.outgoingRequests);
      setBlockedProfiles(graph.blockedProfiles);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load people right now");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !session) {
      return;
    }

    void refreshData();
  }, [open, session?.refreshToken, session?.token]);

  useEffect(() => {
    if (!open || !session || !search.trim()) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);
    window.setTimeout(() => {
      void api
        .searchProfiles(session, search)
        .then((profiles) => {
          if (!cancelled) {
            setResults(profiles);
          }
        })
        .catch((caught) => {
          if (!cancelled) {
            setError(caught instanceof Error ? caught.message : "Search failed");
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearching(false);
          }
        });
    }, 120);

    return () => {
      cancelled = true;
    };
  }, [open, search, session]);

  if (!open || !session) {
    return null;
  }
  const currentSession = session;

  async function openDm(profile: DiscoveryProfile) {
    const conversationId = dmConversationId(currentSession.user.id, profile.id);
    await api.restoreConversation(currentSession, conversationId);
    const bootstrap = await api.me(currentSession.token, currentSession.refreshToken);
    hydrate(bootstrap);
    setActiveConversation(conversationId);
    navigate(`/chat/${conversationId}`);
    onClose();
  }

  async function withAction(profile: DiscoveryProfile, action: () => Promise<unknown>) {
    try {
      setWorkingUserId(profile.id);
      setError(undefined);
      await action();
      await refreshData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed");
    } finally {
      setWorkingUserId(undefined);
    }
  }

  function renderActions(profile: DiscoveryProfile) {
    if (profile.relationship === "accepted") {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void openDm(profile)}
            className="rounded-2xl bg-[#d5f575] px-3 py-2 text-xs font-medium text-black"
          >
            Open DM
          </button>
          <button
            type="button"
            disabled={workingUserId === profile.id}
            onClick={() => void withAction(profile, () => api.blockUser(currentSession, profile.id))}
            className="rounded-2xl border border-rose-300/18 bg-rose-500/8 px-3 py-2 text-xs text-rose-100/84 disabled:opacity-50"
          >
            Block
          </button>
        </div>
      );
    }

    if (profile.relationship === "incoming_pending") {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={workingUserId === profile.id}
            onClick={() => void withAction(profile, () => api.acceptFollowRequest(currentSession, profile.id))}
            className="inline-flex items-center gap-1 rounded-2xl bg-[#d5f575] px-3 py-2 text-xs font-medium text-black disabled:opacity-50"
          >
            <Check size={13} />
            Accept
          </button>
          <button
            type="button"
            disabled={workingUserId === profile.id}
            onClick={() => void withAction(profile, () => api.declineFollowRequest(currentSession, profile.id))}
            className="inline-flex items-center gap-1 rounded-2xl border border-[#1a2336] bg-white/[0.04] px-3 py-2 text-xs text-white/72 disabled:opacity-50"
          >
            <X size={13} />
            Decline
          </button>
          <button
            type="button"
            disabled={workingUserId === profile.id}
            onClick={() => void withAction(profile, () => api.blockUser(currentSession, profile.id))}
            className="rounded-2xl border border-rose-300/18 bg-rose-500/8 px-3 py-2 text-xs text-rose-100/84 disabled:opacity-50"
          >
            Block
          </button>
        </div>
      );
    }

    if (profile.relationship === "outgoing_pending") {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={workingUserId === profile.id}
            onClick={() => void withAction(profile, () => api.removeConnection(currentSession, profile.id))}
            className="rounded-2xl border border-[#1a2336] bg-white/[0.04] px-3 py-2 text-xs text-white/72 disabled:opacity-50"
          >
            Cancel request
          </button>
        </div>
      );
    }

    if (profile.relationship === "blocked") {
      return (
        <button
          type="button"
          disabled={workingUserId === profile.id}
          onClick={() => void withAction(profile, () => api.unblockUser(currentSession, profile.id))}
          className="inline-flex items-center gap-1 rounded-2xl border border-[#1a2336] bg-white/[0.04] px-3 py-2 text-xs text-white/72 disabled:opacity-50"
        >
          <Shield size={13} />
          Unblock
        </button>
      );
    }

    if (profile.relationship === "blocked_by") {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={workingUserId === profile.id}
          onClick={() => void withAction(profile, () => api.sendFollowRequest(currentSession, profile.id))}
          className="inline-flex items-center gap-1 rounded-2xl bg-[#d5f575] px-3 py-2 text-xs font-medium text-black disabled:opacity-50"
        >
          <UserPlus size={13} />
          Follow
        </button>
        <button
          type="button"
          disabled={workingUserId === profile.id}
          onClick={() => void withAction(profile, () => api.blockUser(currentSession, profile.id))}
          className="inline-flex items-center gap-1 rounded-2xl border border-rose-300/18 bg-rose-500/8 px-3 py-2 text-xs text-rose-100/84 disabled:opacity-50"
        >
          <Ban size={13} />
          Block
        </button>
      </div>
    );
  }

  function renderProfileCard(profile: DiscoveryProfile) {
    return (
      <div
        key={profile.id}
        className="rounded-[22px] border border-[#1a2336] bg-[#111215] p-4"
      >
        <div className="flex items-start gap-3">
          <AvatarBadge name={profile.username} avatarUrl={profile.avatarUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-white">{profile.username}</p>
              <span className="rounded-full border border-[#1a2336] bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/46">
                {relationshipLabel(profile)}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/42">{profile.status || "No status yet"}</p>
            <div className="mt-3">{renderActions(profile)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex h-[min(88vh,860px)] w-full max-w-4xl flex-col rounded-[28px] border border-[#182033] bg-[rgba(10,10,12,0.97)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/32">People</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">Search and manage connections</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#1a2336] bg-white/[0.04] px-4 py-2 text-sm text-white/72"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-[24px] border border-[#1a2336] bg-[#111215] px-4 py-3">
          <Search size={16} className="text-white/32" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by username"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
          />
          {searching ? <span className="text-xs text-white/42">Searching...</span> : null}
        </div>

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

        <div className="hide-scrollbar mt-5 grid min-h-0 flex-1 gap-5 overflow-y-auto xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserRoundSearch size={15} className="text-[#dce9a6]" />
              <p className="text-sm font-medium text-white">Search results</p>
            </div>
            {search.trim() ? (
              results.length ? (
                <div className="space-y-3">{results.map(renderProfileCard)}</div>
              ) : (
                <div className="rounded-[22px] border border-[#1a2336] bg-[#111215] p-4 text-sm text-white/42">
                  No profile matched that username.
                </div>
              )
            ) : (
              <div className="rounded-[22px] border border-[#1a2336] bg-[#111215] p-4 text-sm text-white/42">
                Search a username to send a follow request instead of auto-showing everyone in DMs.
              </div>
            )}
          </div>

          <div className="space-y-5">
            {sections.map((section) => (
              <section key={section.title}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{section.title}</p>
                  <span className="rounded-full border border-[#1a2336] px-3 py-1 text-[11px] text-white/46">
                    {section.items.length}
                  </span>
                </div>
                {section.items.length ? (
                  <div className="space-y-3">{section.items.map(renderProfileCard)}</div>
                ) : (
                  <div className="rounded-[22px] border border-[#1a2336] bg-[#111215] p-4 text-sm text-white/42">
                    {loading ? "Refreshing..." : `No ${section.title.toLowerCase()} yet.`}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
