import { useEffect, useMemo, useState } from "react";
import { EyeOff, LockKeyhole, ShieldAlert, Sparkles } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import type { Conversation } from "@frostchat/shared";

import { useAppStore } from "@/store/useAppStore";

import { ChatPanel } from "./ChatPanel";
import { FrostPanel } from "./FrostPanel";

export function SecretVault() {
  const {
    conversations,
    session,
    users,
    secretPin,
    secretUnlocked,
    activeConversationId,
    setActiveConversation,
    setSecretPin,
    unlockSecret,
    lockSecret,
    secretWarningVisible,
    showSecretWarning,
    createSecretConversation,
  } = useAppStore(
    useShallow((state) => ({
      conversations: state.conversations,
      session: state.session,
      users: state.users,
    secretPin: state.secretPin,
    secretUnlocked: state.secretUnlocked,
    activeConversationId: state.activeConversationId,
    setActiveConversation: state.setActiveConversation,
    setSecretPin: state.setSecretPin,
    unlockSecret: state.unlockSecret,
      lockSecret: state.lockSecret,
      secretWarningVisible: state.secretWarningVisible,
      showSecretWarning: state.showSecretWarning,
      createSecretConversation: state.createSecretConversation,
    })),
  );
  const secretConversations = useMemo(
    () => conversations.filter((conversation) => conversation.kind === "secret"),
    [conversations],
  );

  const [pinInput, setPinInput] = useState("");
  const [composeTitle, setComposeTitle] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [nextPin, setNextPin] = useState("");

  useEffect(() => {
    const onBlur = () => showSecretWarning(true);
    const onFocus = () => showSecretWarning(false);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [showSecretWarning]);

  const activeConversation = useMemo(
    () =>
      secretConversations.find((conversation) => conversation.id === activeConversationId) ??
      secretConversations[0],
    [activeConversationId, secretConversations],
  );

  if (!secretUnlocked) {
    return (
      <div className="grid h-full place-items-center">
        <FrostPanel className="w-full max-w-xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/8">
            <LockKeyhole className="text-sky-300" />
          </div>
          <h2 className="font-display text-3xl font-semibold text-white">Hidden Frost Layer</h2>
          <p className="mt-3 text-white/55">
            {secretPin
              ? "Enter your vault PIN to reveal encrypted chats."
              : "Enter the default workspace code to reveal the hidden layer for the first time."}
          </p>
          <input
            type="password"
            value={pinInput}
            onChange={(event) => setPinInput(event.target.value)}
            placeholder="4-8 digit PIN"
            className="mx-auto mt-6 w-full max-w-xs rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-center text-white outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (!secretPin) {
                if (pinInput.trim() === "111222") {
                  setSecretPin("111222");
                  setPinInput("");
                }
                return;
              }
              if (unlockSecret(pinInput)) {
                setPinInput("");
              }
            }}
            className="mt-4 rounded-2xl bg-[linear-gradient(135deg,#5da6ff,#7c83ff)] px-5 py-3 font-medium text-white"
          >
            {secretPin ? "Unlock Secret Chats" : "Reveal Hidden Layer"}
          </button>
        </FrostPanel>
      </div>
    );
  }

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[320px_1fr] secret-mode">
      <FrostPanel className="flex h-full flex-col p-4">
        <div className="mb-4 flex items-center justify-between px-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">Secret Vault</p>
            <h2 className="font-display text-2xl font-semibold text-white">Hidden Threads</h2>
          </div>
          <button
            type="button"
            onClick={lockSecret}
            className="rounded-2xl border border-white/10 bg-white/8 p-3 text-white/80"
          >
            <EyeOff size={16} />
          </button>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
          <p className="mb-3 text-sm text-white/65">Create a secret chat</p>
          <input
            value={composeTitle}
            onChange={(event) => setComposeTitle(event.target.value)}
            placeholder="Moonlight"
            className="mb-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none"
          />
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            className="mb-3 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Choose a friend</option>
            {users
              .filter((user) => user.id !== session?.user.id)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (!session || !composeTitle.trim() || !selectedUserId) {
                return;
              }
              const conversation = createSecretConversation(composeTitle.trim(), [
                session.user.id,
                selectedUserId,
              ]);
              setActiveConversation(conversation.id);
              setComposeTitle("");
              setSelectedUserId("");
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#5da6ff,#7c83ff)] px-4 py-3 text-sm font-medium text-white"
          >
            <Sparkles size={16} />
            Create Hidden Chat
          </button>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/8 bg-black/20 p-4">
          <p className="text-sm text-white/65">Change access code</p>
          <input
            value={nextPin}
            onChange={(event) => setNextPin(event.target.value)}
            placeholder="New local passcode"
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none"
          />
          <button
            type="button"
            disabled={!nextPin.trim()}
            onClick={() => {
              setSecretPin(nextPin.trim());
              setNextPin("");
            }}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Save access code
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {secretConversations.map((conversation: Conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => setActiveConversation(conversation.id)}
              className={`w-full rounded-[24px] border p-4 text-left transition ${
                activeConversation?.id === conversation.id
                  ? "border-sky-300/40 bg-white/12"
                  : "border-white/8 bg-white/5 hover:border-white/15"
              }`}
            >
              <p className="text-sm font-medium text-white">{conversation.title}</p>
              <p className="mt-1 text-xs text-white/50">
                {conversation.participantIds.length} participants
              </p>
            </button>
          ))}
        </div>
      </FrostPanel>
      <div className="relative">
        {secretWarningVisible ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[28px] border border-amber-200/15 bg-[#060812]/90 backdrop-blur-xl">
            <div className="text-center">
              <ShieldAlert className="mx-auto mb-3 text-amber-200" />
              <p className="text-sm uppercase tracking-[0.35em] text-amber-100/70">
                Secret Layer Hidden
              </p>
              <p className="mt-2 text-white/55">
                Window blur detected. FrostChat obscured the vault.
              </p>
            </div>
          </div>
        ) : null}
        <ChatPanel conversation={activeConversation} />
      </div>
    </div>
  );
}
