create table if not exists public.messages (
  id text primary key,
  conversation_id text not null,
  kind text not null,
  type text not null,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  participant_ids uuid[] not null default '{}'::uuid[],
  body text not null default '',
  reply_to_id text,
  attachments jsonb not null default '[]'::jsonb,
  reactions jsonb not null default '[]'::jsonb,
  status text not null default 'sent',
  delivered_to uuid[] not null default '{}'::uuid[],
  seen_by uuid[] not null default '{}'::uuid[],
  mentions uuid[] not null default '{}'::uuid[],
  hidden_for uuid[] not null default '{}'::uuid[],
  is_secret boolean not null default false,
  deleted_for_everyone boolean not null default false,
  self_destruct_seconds integer,
  destruct_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
  on public.messages
  for select
  to authenticated
  using (
    auth.uid() = sender_id
    or auth.uid() = any(participant_ids)
  );

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and (
      auth.uid() = sender_id
      or auth.uid() = any(participant_ids)
    )
  );

drop policy if exists "messages_update_participants" on public.messages;
create policy "messages_update_participants"
  on public.messages
  for update
  to authenticated
  using (
    auth.uid() = sender_id
    or auth.uid() = any(participant_ids)
  )
  with check (
    auth.uid() = sender_id
    or auth.uid() = any(participant_ids)
  );
