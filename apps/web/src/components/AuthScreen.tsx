import { useState } from "react";
import { Shield, Sparkles } from "lucide-react";

import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

import { FrostPanel } from "./FrostPanel";

export function AuthScreen() {
  const hydrate = useAppStore((state) => state.hydrate);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [inviteCode, setInviteCode] = useState("FROST-FRIENDS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setLoading(true);
      setError(undefined);
      const payload = await api.login(email.trim(), passphrase, inviteCode.trim(), username.trim());
      hydrate(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to join FrostChat");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(61,139,255,0.23),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(127,90,240,0.18),transparent_35%)]" />
      <FrostPanel className="relative w-full max-w-5xl overflow-hidden p-8 md:grid md:grid-cols-[1.1fr_0.9fr] md:p-12">
        <div className="pr-0 md:pr-10">
          <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
            <Sparkles size={16} className="text-sky-300" />
            Invite-only private messaging for your circle
          </div>
          <h1 className="max-w-xl font-display text-5xl font-semibold leading-tight text-white md:text-6xl">
            FrostChat keeps your closest conversations luminous and local-first.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/65">
            A premium frosted-glass messenger for direct chats, hidden threads, shared rooms, and media that lives on your devices first.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              "Real-time DMs, reactions, replies, and voice notes",
              "Hidden PIN-locked secret vault with self-destruct support",
              "Ephemeral live rooms with host controls and presence",
            ].map((item) => (
              <div key={item} className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 md:mt-0">
          <form onSubmit={handleSubmit} className="space-y-4 rounded-[28px] border border-white/10 bg-black/30 p-6">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
              <Shield className="text-sky-300" size={18} />
              Email + passphrase with invite-only signup
            </div>
            <label className="block text-sm text-white/70">
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-sky-300/50"
              />
            </label>
            <label className="block text-sm text-white/70">
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="aurora"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-sky-300/50"
              />
            </label>
            <label className="block text-sm text-white/70">
              Passphrase
              <input
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="••••••••"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-sky-300/50"
              />
            </label>
            <label className="block text-sm text-white/70">
              Invite Code
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none transition focus:border-sky-300/50"
              />
            </label>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <button
              type="submit"
              disabled={loading || !email || !username || !passphrase || !inviteCode}
              className="w-full rounded-2xl bg-[linear-gradient(135deg,#5da6ff,#7c83ff)] px-4 py-3 font-medium text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Joining FrostChat..." : "Enter FrostChat"}
            </button>
          </form>
        </div>
      </FrostPanel>
    </div>
  );
}
