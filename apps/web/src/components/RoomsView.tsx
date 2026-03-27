import { useState } from "react";
import { AudioLines, Crown, DoorOpen, MicOff, Plus, RadioTower, Users, Waves } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import type { ChatMessage, LiveRoom } from "@frostchat/shared";

import { api } from "@/lib/api";
import { emitMessage, roomEmit } from "@/lib/socket";
import { useAppStore } from "@/store/useAppStore";

import { FrostPanel } from "./FrostPanel";
import { MessageComposer } from "./MessageComposer";

export function RoomsView() {
  const { session, rooms, activeRoomId, messagesByConversation, upsertRoom, setActiveRoom, addMessage } =
    useAppStore(useShallow((state) => ({
      session: state.session,
      rooms: state.rooms,
      activeRoomId: state.activeRoomId ?? state.rooms[0]?.id,
      messagesByConversation: state.messagesByConversation,
      upsertRoom: state.upsertRoom,
      setActiveRoom: state.setActiveRoom,
      addMessage: state.addMessage,
    })));

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? rooms[0];
  const [draftName, setDraftName] = useState("");
  const [draftTopic, setDraftTopic] = useState("");

  async function createRoom() {
    if (!session || !draftName.trim()) {
      return;
    }
    const room = await api.createRoom(session, {
      name: draftName.trim(),
      topic: draftTopic.trim(),
    });
    upsertRoom(room);
    setActiveRoom(room.id);
    roomEmit("room:join", room.id);
    setDraftName("");
    setDraftTopic("");
  }

  async function sendRoomMessage(payload: {
    body: string;
    attachments?: ChatMessage["attachments"];
  }) {
    if (!session || !activeRoom) {
      return;
    }

    const message = useAppStore.getState().createOutgoingMessage({
      conversation: {
        id: activeRoom.id,
        kind: "room",
      },
      body: payload.body,
      attachments: payload.attachments,
    });
    addMessage(message);
    emitMessage({
      message,
      targetUserIds: activeRoom.participants
        .map((participant) => participant.userId)
        .filter((userId) => userId !== session.user.id),
    });
  }

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[360px_1fr]">
      <FrostPanel className="p-4">
        <div className="mb-4 flex items-center justify-between px-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">Live Rooms</p>
            <h2 className="font-display text-2xl font-semibold text-white">Aurora Spaces</h2>
          </div>
          <Waves className="text-sky-300" size={20} />
        </div>
        <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
          <p className="mb-3 text-sm text-white/65">Create a room</p>
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Late night catch-up"
            className="mb-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none"
          />
          <input
            value={draftTopic}
            onChange={(event) => setDraftTopic(event.target.value)}
            placeholder="Topic / Now hanging out"
            className="mb-3 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={() => void createRoom()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#5da6ff,#7c83ff)] px-4 py-3 text-sm font-medium text-white"
          >
            <Plus size={16} />
            Start Room
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => {
                setActiveRoom(room.id);
                roomEmit("room:join", room.id);
              }}
              className={`w-full rounded-[24px] border p-4 text-left transition ${
                activeRoom?.id === room.id
                  ? "border-sky-300/40 bg-white/12"
                  : "border-white/8 bg-white/5 hover:border-white/15"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{room.name}</p>
                  <p className="mt-1 text-xs text-white/50">{room.topic || "No topic yet"}</p>
                </div>
                <div className="text-right text-xs text-white/45">
                  <p>{room.isLive ? "Live" : "Closed"}</p>
                  <p>{room.participants.length} inside</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </FrostPanel>

      {activeRoom ? (
        <div className="flex h-full flex-col gap-4">
          <FrostPanel className="flex items-center justify-between p-5">
            <div>
              <p className="text-lg font-semibold text-white">{activeRoom.name}</p>
              <p className="text-sm text-white/50">{activeRoom.topic || "Open room"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-white/10 bg-white/7 px-3 py-2 text-xs text-white/75">
                Code {activeRoom.code}
              </div>
              <div className="rounded-full border border-white/10 bg-white/7 px-3 py-2 text-xs text-white/75">
                {activeRoom.nowPlaying || "Now Playing idle"}
              </div>
            </div>
          </FrostPanel>
          <div className="grid flex-1 gap-4 xl:grid-cols-[1fr_300px]">
            <FrostPanel className="flex h-full flex-col justify-between gap-4 p-5">
              <div className="hide-scrollbar flex-1 space-y-3 overflow-y-auto">
                {(messagesByConversation[activeRoom.id] ?? [])
                  .slice()
                  .reverse()
                  .map((message) => (
                    <div key={message.id} className="rounded-[24px] border border-white/8 bg-white/6 px-4 py-3">
                      <div className="mb-2 flex items-center justify-between text-xs text-white/45">
                        <span>
                          {useAppStore.getState().users.find((user) => user.id === message.senderId)?.username ??
                            "Friend"}
                        </span>
                        <span>
                          {new Intl.DateTimeFormat([], {
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(message.createdAt))}
                        </span>
                      </div>
                      <p className="text-sm text-white/85">{message.body}</p>
                    </div>
                  ))}
              </div>
              <MessageComposer
                conversation={{
                  id: activeRoom.id,
                  kind: "room",
                  title: activeRoom.name,
                  participantIds: activeRoom.participants.map((participant) => participant.userId),
                  updatedAt: activeRoom.updatedAt,
                }}
                onTyping={() => undefined}
                onSend={sendRoomMessage}
              />
            </FrostPanel>
            <FrostPanel className="p-4">
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const next = prompt("Set now playing", activeRoom.nowPlaying || "");
                    if (next !== null && session?.user.id === activeRoom.hostId) {
                      roomEmit("room:now-playing", { roomId: activeRoom.id, nowPlaying: next });
                      void api.updateRoom(session, activeRoom.id, { nowPlaying: next }).then(upsertRoom);
                    }
                  }}
                  className="flex items-center justify-between rounded-[24px] border border-white/8 bg-white/6 px-4 py-4 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-white">Now Playing</p>
                    <p className="text-xs text-white/50">Host can broadcast activity</p>
                  </div>
                  <AudioLines className="text-sky-300" size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !activeRoom.readOnly;
                    roomEmit("room:mute", { roomId: activeRoom.id, readOnly: next });
                    if (session?.user.id === activeRoom.hostId) {
                      void api.updateRoom(session, activeRoom.id, { readOnly: next }).then(upsertRoom);
                    }
                  }}
                  className="flex items-center justify-between rounded-[24px] border border-white/8 bg-white/6 px-4 py-4 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {activeRoom.readOnly ? "Read-only mode" : "Open mic chat"}
                    </p>
                    <p className="text-xs text-white/50">Mute everyone or let the room flow</p>
                  </div>
                  <MicOff className="text-sky-300" size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => roomEmit("room:leave", activeRoom.id)}
                  className="flex items-center justify-between rounded-[24px] border border-white/8 bg-white/6 px-4 py-4 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-white">Leave Room</p>
                    <p className="text-xs text-white/50">Exit without closing it for everyone</p>
                  </div>
                  <DoorOpen className="text-sky-300" size={18} />
                </button>
              </div>

              <div className="mt-4 rounded-[24px] border border-white/8 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-white">Participants</p>
                  <span className="inline-flex items-center gap-2 text-xs text-white/50">
                    <Users size={12} />
                    {activeRoom.participants.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {activeRoom.participants.map((participant) => (
                    <div
                      key={participant.userId}
                      className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/6 px-3 py-3 text-sm text-white/75"
                    >
                      <span>{participant.username || participant.userId}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-white/40">
                        {participant.userId === activeRoom.hostId ? (
                          <Crown size={12} className="text-amber-300" />
                        ) : (
                          <RadioTower size={12} />
                        )}
                        {participant.userId === activeRoom.hostId ? "Host" : "Joined"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </FrostPanel>
          </div>
        </div>
      ) : (
        <FrostPanel className="flex h-full items-center justify-center text-white/55">
          Create or join a room to see the live space.
        </FrostPanel>
      )}
    </div>
  );
}
