create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  primary key (follower_id, followee_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_id, blocked_id)
);

create table if not exists public.removed_conversations (
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, conversation_id)
);

create index if not exists follows_followee_status_idx
  on public.follows (followee_id, status, created_at desc);

create index if not exists blocks_blocked_idx
  on public.blocks (blocked_id, created_at desc);

alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.removed_conversations enable row level security;

drop policy if exists "follows_select_participants" on public.follows;
create policy "follows_select_participants"
  on public.follows
  for select
  to authenticated
  using (auth.uid() = follower_id or auth.uid() = followee_id);

drop policy if exists "follows_insert_self" on public.follows;
create policy "follows_insert_self"
  on public.follows
  for insert
  to authenticated
  with check (auth.uid() = follower_id and auth.uid() <> followee_id);

drop policy if exists "follows_update_followee" on public.follows;
create policy "follows_update_followee"
  on public.follows
  for update
  to authenticated
  using (auth.uid() = followee_id)
  with check (auth.uid() = followee_id);

drop policy if exists "follows_delete_participants" on public.follows;
create policy "follows_delete_participants"
  on public.follows
  for delete
  to authenticated
  using (auth.uid() = follower_id or auth.uid() = followee_id);

drop policy if exists "blocks_select_participants" on public.blocks;
create policy "blocks_select_participants"
  on public.blocks
  for select
  to authenticated
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists "blocks_insert_self" on public.blocks;
create policy "blocks_insert_self"
  on public.blocks
  for insert
  to authenticated
  with check (auth.uid() = blocker_id and auth.uid() <> blocked_id);

drop policy if exists "blocks_delete_self" on public.blocks;
create policy "blocks_delete_self"
  on public.blocks
  for delete
  to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "removed_conversations_select_self" on public.removed_conversations;
create policy "removed_conversations_select_self"
  on public.removed_conversations
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "removed_conversations_insert_self" on public.removed_conversations;
create policy "removed_conversations_insert_self"
  on public.removed_conversations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "removed_conversations_delete_self" on public.removed_conversations;
create policy "removed_conversations_delete_self"
  on public.removed_conversations
  for delete
  to authenticated
  using (auth.uid() = user_id);
