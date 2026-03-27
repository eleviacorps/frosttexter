create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  username text not null unique,
  avatar_url text,
  status text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.invite_codes (
  code text primary key,
  label text,
  expires_at timestamptz,
  max_uses integer,
  uses integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.groups (
  id text primary key,
  name text not null,
  avatar_url text,
  description text,
  admin_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.group_members (
  group_id text not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  muted boolean not null default false,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (group_id, user_id)
);

create table if not exists public.rooms (
  id text primary key,
  code text not null unique,
  name text not null,
  topic text,
  host_id uuid not null references public.profiles (id) on delete cascade,
  now_playing text,
  read_only boolean not null default false,
  is_live boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.room_members (
  room_id text not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (room_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "invite_codes_readable" on public.invite_codes;
create policy "invite_codes_readable"
  on public.invite_codes
  for select
  to anon, authenticated
  using (
    expires_at is null
    or expires_at > timezone('utc', now())
  );

drop policy if exists "groups_select_authenticated" on public.groups;
create policy "groups_select_authenticated"
  on public.groups
  for select
  to authenticated
  using (true);

drop policy if exists "groups_insert_admin" on public.groups;
create policy "groups_insert_admin"
  on public.groups
  for insert
  to authenticated
  with check (auth.uid() = admin_id);

drop policy if exists "groups_update_admin" on public.groups;
create policy "groups_update_admin"
  on public.groups
  for update
  to authenticated
  using (auth.uid() = admin_id)
  with check (auth.uid() = admin_id);

drop policy if exists "group_members_select_authenticated" on public.group_members;
create policy "group_members_select_authenticated"
  on public.group_members
  for select
  to authenticated
  using (true);

drop policy if exists "group_members_insert_authenticated" on public.group_members;
create policy "group_members_insert_authenticated"
  on public.group_members
  for insert
  to authenticated
  with check (true);

drop policy if exists "group_members_delete_authenticated" on public.group_members;
create policy "group_members_delete_authenticated"
  on public.group_members
  for delete
  to authenticated
  using (true);

drop policy if exists "rooms_select_authenticated" on public.rooms;
create policy "rooms_select_authenticated"
  on public.rooms
  for select
  to authenticated
  using (true);

drop policy if exists "rooms_insert_host" on public.rooms;
create policy "rooms_insert_host"
  on public.rooms
  for insert
  to authenticated
  with check (auth.uid() = host_id);

drop policy if exists "rooms_update_host" on public.rooms;
create policy "rooms_update_host"
  on public.rooms
  for update
  to authenticated
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

drop policy if exists "room_members_select_authenticated" on public.room_members;
create policy "room_members_select_authenticated"
  on public.room_members
  for select
  to authenticated
  using (true);

drop policy if exists "room_members_insert_self" on public.room_members;
create policy "room_members_insert_self"
  on public.room_members
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "room_members_delete_self" on public.room_members;
create policy "room_members_delete_self"
  on public.room_members
  for delete
  to authenticated
  using (auth.uid() = user_id);

insert into public.invite_codes (code, label)
values ('FROST-FRIENDS', 'Default FrostChat Invite')
on conflict (code) do nothing;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "attachments_public_read" on storage.objects;
create policy "attachments_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'attachments');

drop policy if exists "attachments_authenticated_upload" on storage.objects;
create policy "attachments_authenticated_upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'attachments');

drop policy if exists "attachments_owner_update" on storage.objects;
create policy "attachments_owner_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'attachments')
  with check (bucket_id = 'attachments');

drop policy if exists "attachments_owner_delete" on storage.objects;
create policy "attachments_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'attachments');
