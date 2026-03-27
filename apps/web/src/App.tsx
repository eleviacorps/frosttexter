import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, PanelLeftClose } from "lucide-react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import type { LiveRoom } from "@frostchat/shared";

import { api } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { AuthScreen } from "@/components/AuthScreen";
import { ChatPanel } from "@/components/ChatPanel";
import { FrostPanel } from "@/components/FrostPanel";
import { RoomsView } from "@/components/RoomsView";
import { SecretVault } from "@/components/SecretVault";
import { Sidebar } from "@/components/Sidebar";
import { useAppStore } from "@/store/useAppStore";

function ChatRoute() {
  const { conversationId } = useParams();
  const setActiveConversation = useAppStore((state) => state.setActiveConversation);
  const conversation = useAppStore((state) =>
    conversationId
      ? state.conversations.find((item) => item.id === conversationId)
      : state.conversations.find((item) => item.id === state.activeConversationId),
  );

  useEffect(() => {
    if (conversationId) {
      setActiveConversation(conversationId);
    }
  }, [conversationId, setActiveConversation]);

  return <ChatPanel conversation={conversation} />;
}

function FrostWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const bootstrapTokenRef = useRef<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  const {
    session,
    users,
    activeConversationId,
    conversations,
    rooms,
    hydrate,
    setUploadConfig,
    mergeMessages,
    addMessage,
    updateMessageStatus,
    toggleReaction,
    deleteMessage,
    setTyping,
    setOnlineUsers,
    setSocketConnected,
    upsertRoom,
    upsertRoomParticipants,
    setActiveConversation,
    setActiveRoom,
    upsertConversation,
  } = useAppStore(
    useShallow((state) => ({
      session: state.session,
      users: state.users,
      activeConversationId: state.activeConversationId,
      conversations: state.conversations,
      rooms: state.rooms,
      hydrate: state.hydrate,
      setUploadConfig: state.setUploadConfig,
      mergeMessages: state.mergeMessages,
      addMessage: state.addMessage,
      updateMessageStatus: state.updateMessageStatus,
      toggleReaction: state.toggleReaction,
      deleteMessage: state.deleteMessage,
      setTyping: state.setTyping,
      setOnlineUsers: state.setOnlineUsers,
      setSocketConnected: state.setSocketConnected,
      upsertRoom: state.upsertRoom,
      upsertRoomParticipants: state.upsertRoomParticipants,
      setActiveConversation: state.setActiveConversation,
      setActiveRoom: state.setActiveRoom,
      upsertConversation: state.upsertConversation,
    })),
  );

  const sessionToken = session?.token;

  useEffect(() => {
    if (!sessionToken || bootstrapTokenRef.current === sessionToken) {
      return;
    }

    bootstrapTokenRef.current = sessionToken;

    let cancelled = false;
    void Promise.all([api.me(sessionToken, session?.refreshToken), api.uploadConfig(sessionToken)]).then(
      ([bootstrap, uploadConfig]) => {
        if (cancelled) {
          return;
        }

        hydrate(bootstrap);
        setUploadConfig(uploadConfig);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [hydrate, session?.refreshToken, sessionToken, setUploadConfig]);

  useEffect(() => {
    if (!session) {
      return;
    }

    connectSocket(
      session,
      {
        onConnect: () => setSocketConnected(true),
        onDisconnect: () => setSocketConnected(false),
        onPresence: (userIds) => setOnlineUsers(userIds),
        onMessage: (message) => addMessage(message),
        onMessageStatus: ({ conversationId, messageId, status, userId }) =>
          updateMessageStatus({ conversationId, messageId, status, userId }),
        onReaction: (payload) => toggleReaction(payload),
        onDelete: (payload) => deleteMessage(payload),
        onTyping: (payload, active) => setTyping(payload.conversationId, payload.userId, active),
        onCache: (messages) => {
          if (messages[0]) {
            mergeMessages(messages[0].conversationId, messages);
          }
        },
        onRoomParticipants: (roomId, participants) => {
          if (roomId) {
            upsertRoomParticipants(roomId, participants);
          }
        },
        onRoomUpdated: (room) => upsertRoom(room as LiveRoom),
        onRoomEntry: (entry) => {
          const roomId = useAppStore.getState().activeRoomId;
          if (!roomId || !session) {
            return;
          }

          addMessage({
            id: `sys_${Date.now()}`,
            conversationId: roomId,
            kind: "room",
            type: "system",
            senderId: session.user.id,
            body: entry,
            createdAt: new Date().toISOString(),
            status: "delivered",
          });
        },
        onRoomKicked: (roomId) => {
          setActiveRoom(undefined);
          if (useAppStore.getState().activeRoomId === roomId) {
            navigate("/rooms");
          }
        },
      },
      {
        conversationIds: conversations.map((conversation) => conversation.id),
        roomIds: rooms.map((room) => room.id),
      },
    );
  }, [
    addMessage,
    conversations,
    deleteMessage,
    mergeMessages,
    navigate,
    rooms,
    session,
    setActiveRoom,
    setOnlineUsers,
    setSocketConnected,
    setTyping,
    setUploadConfig,
    toggleReaction,
    updateMessageStatus,
    upsertRoom,
    upsertRoomParticipants,
  ]);

  useEffect(() => {
    if (activeConversationId) {
      const conversation = conversations.find((item) => item.id === activeConversationId);
      const targetPath = conversation ? `/chat/${conversation.id}` : undefined;
      if (
        conversation &&
        targetPath &&
        !location.pathname.startsWith("/secret") &&
        !location.pathname.startsWith("/rooms") &&
        location.pathname !== targetPath
      ) {
        navigate(targetPath, { replace: true });
      }
    }
  }, [activeConversationId, conversations, location.pathname, navigate]);

  const selectableUsers = useMemo(
    () => users.filter((user) => user.id !== session?.user.id),
    [session?.user.id, users],
  );

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen p-3 md:p-4">
      <FrostPanel className="mx-auto flex h-[calc(100vh-24px)] max-w-[1760px] overflow-hidden rounded-[30px] border-[#182033] bg-[rgba(8,8,10,0.92)] md:h-[calc(100vh-32px)]">
        <div className="hidden h-full w-[360px] shrink-0 border-r border-[#182033] lg:block">
          <Sidebar onCreateGroup={() => setShowGroupModal(true)} />
        </div>

        {sidebarOpen ? (
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <div
          className={`fixed inset-y-3 left-3 z-50 w-[min(92vw,360px)] overflow-hidden rounded-[30px] border border-[#182033] bg-[rgba(8,8,10,0.96)] shadow-[0_30px_80px_rgba(0,0,0,0.45)] transition duration-200 md:inset-y-4 md:left-4 lg:hidden ${
            sidebarOpen ? "translate-x-0" : "-translate-x-[110%]"
          }`}
        >
          <Sidebar onCreateGroup={() => setShowGroupModal(true)} />
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[#182033] px-4 py-3 lg:hidden">
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-white/30">FrostChat</p>
              <p className="mt-1 text-sm font-medium text-white">Messages</p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen((current) => !current)}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-[#1a2336] bg-white/[0.03] text-white/78"
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <Menu size={18} />}
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            <Routes>
              <Route path="/chat/:conversationId" element={<ChatRoute />} />
              <Route path="/chat" element={<ChatRoute />} />
              <Route path="/rooms" element={<RoomsView />} />
              <Route path="/secret" element={<SecretVault />} />
              <Route path="*" element={<Navigate to="/chat" replace />} />
            </Routes>

            {showGroupModal ? (
              <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
                <FrostPanel className="w-full max-w-xl rounded-[28px] border-[#182033] bg-[rgba(10,10,12,0.94)] p-6">
                  <h3 className="text-2xl font-semibold tracking-tight text-white">New Group</h3>
                  <p className="mt-2 text-sm text-white/50">
                    Pick a name and choose the friends who should join.
                  </p>

                  <input
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    placeholder="Weekend plans"
                    className="frost-input mt-5 w-full rounded-2xl px-4 py-3 outline-none"
                  />

                  <div className="mt-4 grid max-h-56 gap-2 overflow-y-auto">
                    {selectableUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() =>
                          setGroupMembers((current) =>
                            current.includes(user.id)
                              ? current.filter((id) => id !== user.id)
                              : [...current, user.id],
                          )
                        }
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          groupMembers.includes(user.id)
                            ? "border-[#24304b] bg-[#d5f575]/10 text-white"
                            : "border-[#1a2336] bg-white/[0.03] text-white/68"
                        }`}
                      >
                        {user.username}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowGroupModal(false);
                        setGroupName("");
                        setGroupMembers([]);
                      }}
                      className="rounded-2xl border border-[#1a2336] bg-white/[0.04] px-4 py-3 text-sm text-white/75"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!session) {
                          return;
                        }

                        void api
                          .createGroup(session, {
                            name: groupName || "New Group",
                            memberIds: groupMembers,
                          })
                          .then((conversation) => {
                            upsertConversation(conversation);
                            setActiveConversation(conversation.id);
                            navigate(`/chat/${conversation.id}`);
                            setShowGroupModal(false);
                            setGroupName("");
                            setGroupMembers([]);
                          });
                      }}
                      className="rounded-2xl bg-[#d5f575] px-4 py-3 text-sm font-medium text-black"
                    >
                      Create Group
                    </button>
                  </div>
                </FrostPanel>
              </div>
            ) : null}
          </div>
        </div>
      </FrostPanel>
    </div>
  );
}

export default function App() {
  const session = useAppStore((state) => state.session);
  const hasHydrated = useAppStore((state) => state.hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <FrostPanel className="w-full max-w-md rounded-[28px] bg-[rgba(9,9,11,0.94)] p-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/32">FrostChat</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Restoring your space
          </h1>
          <p className="mt-3 text-sm text-white/52">Loading your local session and conversations.</p>
        </FrostPanel>
      </div>
    );
  }

  return session ? <FrostWorkspace /> : <AuthScreen />;
}
