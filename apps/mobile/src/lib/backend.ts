import type { AuthSession, BootstrapPayload, Conversation, FrostUser, LiveRoom } from "@frostchat/shared";
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

interface FollowRow {
  follower_id: string;
  followee_id: string;
  status: "pending" | "accepted";
}

interface BlockRow {
  blocker_id: string;
  blocked_id: string;
}

interface RemovedConversationRow {
  user_id: string;
  conversation_id: string;
}

function toUser(row: ProfileRow): FrostUser {
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url ?? undefined,
    status: row.status ?? undefined,
  };
}

function buildAuthSession(session: Session, user: FrostUser): AuthSession {
  return {
    token: session.access_token,
    refreshToken: session.refresh_token,
    user,
  };
}

function dmConversationId(userA: string, userB: string) {
  return ["dm", ...[userA, userB].sort()].join("_");
}

function buildRelationshipIndex(currentUserId: string, follows: FollowRow[], blocks: BlockRow[]) {
  const accepted = new Set<string>();
  const blocked = new Set<string>();
  const blockedBy = new Set<string>();

  follows.forEach((follow) => {
    if (follow.status !== "accepted") {
      return;
    }

    if (follow.follower_id === currentUserId) {
      accepted.add(follow.followee_id);
    } else if (follow.followee_id === currentUserId) {
      accepted.add(follow.follower_id);
    }
  });

  blocks.forEach((block) => {
    if (block.blocker_id === currentUserId) {
      blocked.add(block.blocked_id);
    } else if (block.blocked_id === currentUserId) {
      blockedBy.add(block.blocker_id);
    }
  });

  return { accepted, blocked, blockedBy };
}

function buildDmConversations(
  users: FrostUser[],
  currentUserId: string,
  acceptedUserIds: Set<string>,
  removedConversationIds: Set<string>,
): Conversation[] {
  return users
    .filter(
      (user) =>
        user.id !== currentUserId &&
        acceptedUserIds.has(user.id) &&
        !removedConversationIds.has(dmConversationId(currentUserId, user.id)),
    )
    .map((user) => ({
      id: dmConversationId(currentUserId, user.id),
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

export async function buildBootstrapFromSession(session: Session): Promise<BootstrapPayload> {
  assertSupabaseConfigured();

  const [
    { data: profiles, error: profilesError },
    { data: memberships, error: membershipsError },
    { data: rooms, error: roomsError },
    { data: follows, error: followsError },
    { data: blocks, error: blocksError },
    { data: removedConversations, error: removedError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, username, avatar_url, status, created_at")
      .order("username", { ascending: true }),
    supabase.from("group_members").select("group_id, user_id").eq("user_id", session.user.id),
    supabase
      .from("rooms")
      .select("id, code, name, topic, host_id, now_playing, read_only, is_live, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("follows")
      .select("follower_id, followee_id, status")
      .or(`follower_id.eq.${session.user.id},followee_id.eq.${session.user.id}`),
    supabase
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${session.user.id},blocked_id.eq.${session.user.id}`),
    supabase
      .from("removed_conversations")
      .select("user_id, conversation_id")
      .eq("user_id", session.user.id),
  ]);

  if (profilesError) throw new Error(profilesError.message);
  if (membershipsError) throw new Error(membershipsError.message);
  if (roomsError) throw new Error(roomsError.message);
  if (followsError) throw new Error(followsError.message);
  if (blocksError) throw new Error(blocksError.message);
  if (removedError) throw new Error(removedError.message);

  const users = (profiles ?? []).map((row) => toUser(row as ProfileRow));
  const currentUser = users.find((user) => user.id === session.user.id);
  if (!currentUser) {
    throw new Error("Your FrostChat profile is missing.");
  }
  const relationshipIndex = buildRelationshipIndex(
    currentUser.id,
    (follows ?? []) as FollowRow[],
    (blocks ?? []) as BlockRow[],
  );
  const removedConversationIds = new Set(
    ((removedConversations ?? []) as RemovedConversationRow[]).map((item) => item.conversation_id),
  );

  const groupIds = (memberships ?? []).map((membership) => membership.group_id);
  const [{ data: groups, error: groupsError }, { data: allGroupMembers, error: membersError }, { data: roomMembers, error: roomMembersError }] =
    await Promise.all([
      groupIds.length
        ? supabase
            .from("groups")
            .select("id, name, avatar_url, description, admin_id, updated_at")
            .in("id", groupIds)
        : Promise.resolve({ data: [], error: null }),
      groupIds.length
        ? supabase.from("group_members").select("group_id, user_id").in("group_id", groupIds)
        : Promise.resolve({ data: [], error: null }),
      (rooms ?? []).length
        ? supabase
            .from("room_members")
            .select("room_id, user_id, joined_at")
            .in("room_id", (rooms ?? []).map((room) => room.id))
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (groupsError) throw new Error(groupsError.message);
  if (membersError) throw new Error(membersError.message);
  if (roomMembersError) throw new Error(roomMembersError.message);

  return {
    session: buildAuthSession(session, currentUser),
    users,
    conversations: [
      ...((groups ?? []) as GroupRow[]).map((group) => ({
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
      ...buildDmConversations(
        users.filter(
          (user) =>
            !relationshipIndex.blocked.has(user.id) && !relationshipIndex.blockedBy.has(user.id),
        ),
        currentUser.id,
        relationshipIndex.accepted,
        removedConversationIds,
      ),
    ],
    rooms: ((rooms ?? []) as RoomRow[]).map((room) => ({
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
    })),
    inviteCodeHint: supabaseConfig.inviteCodeHint,
  };
}

export const backend = {
  async login(email: string, passphrase: string, inviteCode: string, username: string) {
    assertSupabaseConfigured();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    let activeSession: Session | null = null;

    const signIn = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: passphrase,
    });

    if (signIn.data.session) {
      activeSession = signIn.data.session;
    } else if (signIn.error) {
      await validateInviteCode(inviteCode.trim());
      const signUp = await supabase.auth.signUp({
        email: normalizedEmail,
        password: passphrase,
        options: {
          data: { username: normalizedUsername },
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
      activeSession = signUp.data.session;
    }

    if (!activeSession) {
      throw new Error("Unable to start a FrostChat session.");
    }

    if (normalizedUsername) {
      await ensureProfile(activeSession.user.id, normalizedEmail, normalizedUsername);
    }

    return buildBootstrapFromSession(activeSession);
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
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error("Unauthorized");
    return buildBootstrapFromSession(data.session);
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

    if (error) throw new Error(error.message);
    return room;
  },
};
