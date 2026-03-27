import type { BootstrapPayload, LiveRoom } from "@frostchat/shared";
import type { AuthSession } from "@frostchat/shared";

import { backend } from "./backend";

export const mobileApi = {
  baseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  login(email: string, passphrase: string, inviteCode: string, username: string) {
    return backend.login(email, passphrase, inviteCode, username);
  },
  me(token: string, refreshToken?: string): Promise<BootstrapPayload> {
    return backend.me(token, refreshToken);
  },
  createRoom(session: AuthSession, payload: { name: string; topic?: string }): Promise<LiveRoom> {
    return backend.createRoom(session, payload);
  },
};
