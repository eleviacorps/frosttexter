import type {
  AuthSession,
  BootstrapPayload,
  Conversation,
  FrostUser,
  LiveRoom,
  UploadConfig,
} from "@frostchat/shared";
import { createEntityId } from "@frostchat/shared";
import type { Session } from "@supabase/supabase-js";

import { assertSupabaseConfigured, supabase, supabaseConfig } from "./supabase";

interface ProfileRow {
  id: string;
  email?: string | null;
  username: string;
  avatar_url?: string | null;
  status?: string | null;
  created_at?: string;
}

interface GroupRow {
  id: string;
  name: string;
  avatar_url?: string | null;
  description?: string | null;
  admin_id: string;
  updated_at: string;
}

interface GroupMemberRow {
  group_id: string;
  user_id: string;
  muted?: boolean | null;
  joined_at: string;
}

interface RoomRow {
  id: string;
  code: string;
  name: string;
  topic?: string | null;
  host_id: string;
  now_playing?: string | null;
  read_only?: boolean | null;
  is_live: boolean;
  updated_at: string;
}

interface RoomMemberRow {
  room_id: string;
  user_id: string;
  joined_at: string;
}

interface InviteCodeRow {
  code: string;
  expires_at?: string | null;
  max_uses?: number | null;
  uses?: number | null;
}

function toUser(row: ProfileRow): FrostUser {
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url ?? undefined,
    status: row.status ?? undefined,
  };
}

function toAuthSession(session: Session, profile: FrostUser): AuthSession {
  return {
    token: session.access_token,
    refreshToken: session.refresh_token,
    user: profile,
  };
}

function buildDmConversations(users: FrostUser[], currentUserId: string): Conversation[] {
  return users
    .filter((user) => user.id !== currentUserId)
    .map((user) => ({
      id: ["dm", ...[currentUserId, user.id].sort()].join("_"),
      kind: "dm" as const,
      title: user.username,
      participantIds: [currentUserId, user.id],
      avatarUrl: user.avatarUrl,
      updatedAt: new Date().toISOString(),
    }));
}

async function validateInviteCode(inviteCode: string) {
  const { data, error } = await supabase
    .from("invite_codes")
    .select("code, expires_at, max_uses, uses")
    .eq("code", inviteCode)
    .maybeSingle<InviteCodeRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Invite code is invalid");
  }

  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("Invite code has expired");
  }

  if (data.max_uses && (data.uses ?? 0) >= data.max_uses) {
    throw new Error("Invite code has already been used up");
  }
}

async function consumeInviteCode(inviteCode: string) {
  const { error } = await supabase.rpc("consume_invite_code", {
    input_code: inviteCode,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function ensureProfile(userId: string, email: string, username: string) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      username,
      created_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, username, avatar_url, status, created_at")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Your FrostChat profile could not be found.");
  }

  return toUser(data);
}

export async function buildBootstrapFromSession(session: Session): Promise<BootstrapPayload> {
  assertSupabaseConfigured();

  const [{ data: profiles, error: profilesError }, { data: memberships, error: membershipsError }, { data: rooms, error: roomsError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, username, avatar_url, status, created_at")
        .order("username", { ascending: true }),
      supabase
        .from("group_members")
        .select("group_id, user_id, muted, joined_at")
        .eq("user_id", session.user.id),
      supabase
        .from("rooms")
        .select("id, code, name, topic, host_id, now_playing, read_only, is_live, updated_at")
        .order("updated_at", { ascending: false }),
    ]);

  if (profilesError) {
    throw new Error(profilesError.message);
  }
  if (membershipsError) {
    throw new Error(membershipsError.message);
  }
  if (roomsError) {
    throw new Error(roomsError.message);
  }

  const users = (profiles ?? []).map((row) => toUser(row as ProfileRow));
  const currentUser = users.find((user) => user.id === session.user.id);
  if (!currentUser) {
    throw new Error("Your FrostChat profile is missing.");
  }

  const groupIds = (memberships ?? []).map((membership) => membership.group_id);
  const [{ data: groupRows, error: groupsError }, { data: allGroupMembers, error: allGroupMembersError }, { data: roomMembers, error: roomMembersError }] =
    await Promise.all([
      groupIds.length
        ? supabase
            .from("groups")
            .select("id, name, avatar_url, description, admin_id, updated_at")
            .in("id", groupIds)
        : Promise.resolve({ data: [], error: null }),
      groupIds.length
        ? supabase
            .from("group_members")
            .select("group_id, user_id, muted, joined_at")
            .in("group_id", groupIds)
        : Promise.resolve({ data: [], error: null }),
      (rooms ?? []).length
        ? supabase
            .from("room_members")
            .select("room_id, user_id, joined_at")
            .in("room_id", (rooms ?? []).map((room) => room.id))
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (groupsError) {
    throw new Error(groupsError.message);
  }
  if (allGroupMembersError) {
    throw new Error(allGroupMembersError.message);
  }
  if (roomMembersError) {
    throw new Error(roomMembersError.message);
  }

  const conversations: Conversation[] = [
    ...((groupRows ?? []) as GroupRow[]).map((group) => ({
      id: group.id,
      kind: "group" as const,
      title: group.name,
      participantIds: ((allGroupMembers ?? []) as GroupMemberRow[])
        .filter((member) => member.group_id === group.id)
        .map((member) => member.user_id),
      avatarUrl: group.avatar_url ?? undefined,
      adminIds: [group.admin_id],
      description: group.description ?? undefined,
      updatedAt: group.updated_at,
    })),
    ...buildDmConversations(users, currentUser.id),
  ];

  const liveRooms: LiveRoom[] = ((rooms ?? []) as RoomRow[]).map((room) => ({
    id: room.id,
    code: room.code,
    name: room.name,
    topic: room.topic ?? undefined,
    hostId: room.host_id,
    nowPlaying: room.now_playing ?? undefined,
    readOnly: Boolean(room.read_only),
    isLive: Boolean(room.is_live),
    participants: ((roomMembers ?? []) as RoomMemberRow[])
      .filter((member) => member.room_id === room.id)
      .map((member) => ({
        userId: member.user_id,
        joinedAt: member.joined_at,
        username: users.find((user) => user.id === member.user_id)?.username,
      })),
    updatedAt: room.updated_at,
  }));

  return {
    session: toAuthSession(session, currentUser),
    users,
    conversations,
    rooms: liveRooms,
    inviteCodeHint: supabaseConfig.inviteCodeHint,
  };
}

export const backend = {
  baseUrl: supabaseConfig.url,
  async login(email: string, passphrase: string, inviteCode: string, username: string) {
    assertSupabaseConfigured();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    let signInSession: Session | null = null;

    const signIn = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: passphrase,
    });

    if (signIn.data.session) {
      signInSession = signIn.data.session;
    } else if (signIn.error) {
      await validateInviteCode(inviteCode.trim());

      const signUp = await supabase.auth.signUp({
        email: normalizedEmail,
        password: passphrase,
        options: {
          data: {
            username: normalizedUsername,
          },
        },
      });

      if (signUp.error) {
        throw new Error(signUp.error.message);
      }

      if (!signUp.data.user) {
        throw new Error("Supabase sign-up did not return a user profile.");
      }

      if (!signUp.data.session) {
        throw new Error("Sign-up succeeded. Disable email confirmation or verify the inbox before logging in.");
      }

      await consumeInviteCode(inviteCode.trim());
      await ensureProfile(signUp.data.user.id, normalizedEmail, normalizedUsername);
      signInSession = signUp.data.session;
    }

    if (!signInSession) {
      throw new Error("Unable to start a FrostChat session.");
    }

    if (normalizedUsername) {
      await ensureProfile(signInSession.user.id, normalizedEmail, normalizedUsername);
    }

    return buildBootstrapFromSession(signInSession);
  },
  async me(token?: string, refreshToken?: string) {
    assertSupabaseConfigured();

    if (token && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: refreshToken,
      });
      if (error) {
        throw new Error(error.message);
      }
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(error.message);
    }
    if (!data.session) {
      throw new Error("Unauthorized");
    }

    return buildBootstrapFromSession(data.session);
  },
  async uploadConfig(_token?: string): Promise<UploadConfig> {
    return {
      bucket: supabaseConfig.storageBucket,
    };
  },
  async createGroup(
    session: AuthSession,
    payload: { name: string; description?: string; memberIds: string[]; avatarUrl?: string },
  ) {
    const id = createEntityId("grp");
    const now = new Date().toISOString();
    const memberIds = Array.from(new Set([session.user.id, ...payload.memberIds]));

    const { error: groupError } = await supabase.from("groups").insert({
      id,
      name: payload.name,
      avatar_url: payload.avatarUrl ?? null,
      description: payload.description ?? null,
      admin_id: session.user.id,
      created_at: now,
      updated_at: now,
    });

    if (groupError) {
      throw new Error(groupError.message);
    }

    const { error: membersError } = await supabase.from("group_members").insert(
      memberIds.map((memberId) => ({
        group_id: id,
        user_id: memberId,
        joined_at: now,
      })),
    );

    if (membersError) {
      throw new Error(membersError.message);
    }

    return {
      id,
      kind: "group" as const,
      title: payload.name,
      participantIds: memberIds,
      avatarUrl: payload.avatarUrl,
      adminIds: [session.user.id],
      description: payload.description,
      updatedAt: now,
    };
  },
  async createRoom(session: AuthSession, payload: { name: string; topic?: string }) {
    const now = new Date().toISOString();
    const room: LiveRoom = {
      id: createEntityId("room"),
      code: createEntityId("join"),
      name: payload.name,
      topic: payload.topic || undefined,
      hostId: session.user.id,
      nowPlaying: undefined,
      readOnly: false,
      isLive: true,
      participants: [],
      updatedAt: now,
    };

    const { error } = await supabase.from("rooms").insert({
      id: room.id,
      code: room.code,
      name: room.name,
      topic: room.topic ?? null,
      host_id: room.hostId,
      now_playing: null,
      read_only: false,
      is_live: true,
      created_at: now,
      updated_at: now,
    });

    if (error) {
      throw new Error(error.message);
    }

    return room;
  },
  async updateRoom(
    roomId: string,
    payload: Partial<{ name: string; topic: string; nowPlaying: string; readOnly: boolean; isLive: boolean }>,
  ) {
    const { data, error } = await supabase
      .from("rooms")
      .update({
        name: payload.name,
        topic: payload.topic,
        now_playing: payload.nowPlaying,
        read_only: payload.readOnly,
        is_live: payload.isLive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId)
      .select("id, code, name, topic, host_id, now_playing, read_only, is_live, updated_at")
      .single<RoomRow>();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      code: data.code,
      name: data.name,
      topic: data.topic ?? undefined,
      hostId: data.host_id,
      nowPlaying: data.now_playing ?? undefined,
      readOnly: Boolean(data.read_only),
      isLive: Boolean(data.is_live),
      participants: [],
      updatedAt: data.updated_at,
    } satisfies LiveRoom;
  },
  async joinRoom(session: AuthSession, roomId: string) {
    const { error } = await supabase.from("room_members").upsert(
      {
        room_id: roomId,
        user_id: session.user.id,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "room_id,user_id" },
    );

    if (error) {
      throw new Error(error.message);
    }
  },
  async leaveRoom(session: AuthSession, roomId: string) {
    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", session.user.id);

    if (error) {
      throw new Error(error.message);
    }
  },
};
