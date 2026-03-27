create or replace function public.consume_invite_code(input_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.invite_codes%rowtype;
begin
  select *
  into invite_row
  from public.invite_codes
  where code = input_code
  for update;

  if not found then
    raise exception 'Invite code is invalid';
  end if;

  if invite_row.expires_at is not null and invite_row.expires_at < timezone('utc', now()) then
    raise exception 'Invite code has expired';
  end if;

  if invite_row.max_uses is not null and invite_row.uses >= invite_row.max_uses then
    raise exception 'Invite code has already been used up';
  end if;

  update public.invite_codes
  set uses = uses + 1
  where code = input_code;
end;
$$;

grant execute on function public.consume_invite_code(text) to anon, authenticated;
