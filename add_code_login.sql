-- Run this in Supabase Dashboard → SQL Editor.
-- Lets the client resolve "code -> email" so a returning user can log in
-- with just their 6-character code + password instead of typing their email.
--
-- Security note: this makes email lookup-by-code possible for ANYONE,
-- logged in or not (that's the point — it has to run before login).
-- Codes are 6 chars from a 32-character set (~1 billion combinations),
-- so casual guessing isn't practical, but it isn't rate-limited by default.
-- If you want to harden this later: Project Settings → API → rate limits,
-- or add a small per-IP/per-code attempt counter table.

create or replace function public.get_email_for_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  target_email text;
begin
  select id into target_id from public.profiles where code = upper(p_code);
  if target_id is null then
    return null;
  end if;

  select email into target_email from auth.users where id = target_id;
  return target_email;
end;
$$;

grant execute on function public.get_email_for_code(text) to anon, authenticated;
