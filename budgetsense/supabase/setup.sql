-- BudgetSense: one-time database setup.
-- Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
-- Safe to run again; it only creates what is missing.

-- 1. Your data, one row per person (plan, budgets, goals, entries, voice-note transcripts).
create table if not exists public.bs_state (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. Inbox: bank SMS and emails land here; the app reads them, adds the payments and deletes the messages.
create table if not exists public.bs_inbox (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  raw         text not null,
  channel     text not null default 'sms',
  received_at timestamptz not null default now(),
  taken       boolean not null default false
);
create index if not exists bs_inbox_waiting on public.bs_inbox (user_id, taken, received_at);

-- 3. Capture keys: a private key per person, used by the phone and Gmail to post into the inbox.
create table if not exists public.bs_keys (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  key        text not null unique,
  created_at timestamptz not null default now()
);

alter table public.bs_state enable row level security;
alter table public.bs_inbox enable row level security;
alter table public.bs_keys  enable row level security;

drop policy if exists "bs_state: own row" on public.bs_state;
create policy "bs_state: own row" on public.bs_state for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "bs_inbox: read own" on public.bs_inbox;
create policy "bs_inbox: read own" on public.bs_inbox for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "bs_inbox: mark own" on public.bs_inbox;
create policy "bs_inbox: mark own" on public.bs_inbox for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "bs_inbox: clear own" on public.bs_inbox;
create policy "bs_inbox: clear own" on public.bs_inbox for delete to authenticated
  using ((select auth.uid()) = user_id);
-- bs_keys has no policies: it is reachable only through the functions below.

revoke all on public.bs_state, public.bs_inbox, public.bs_keys from anon;
grant select, insert, update, delete on public.bs_state to authenticated;
grant select, update, delete on public.bs_inbox to authenticated;
revoke all on public.bs_keys from authenticated;

-- Private helper, not exposed to the web API.
create schema if not exists bs_private;
revoke all on schema bs_private from public;

create or replace function bs_private.push(p_key text, p_raw text, p_channel text)
returns text language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  if p_key is null or length(p_key) < 32 then raise exception 'missing capture key' using errcode = '28000'; end if;
  select user_id into u from public.bs_keys where key = p_key;
  if u is null then raise exception 'unknown capture key' using errcode = '28000'; end if;
  if p_raw is null or length(btrim(p_raw)) = 0 then return 'empty'; end if;
  if (select count(*) from public.bs_inbox where user_id = u and not taken) >= 1000 then
    raise exception 'inbox full: open BudgetSense to clear it' using errcode = '54000';
  end if;
  insert into public.bs_inbox (user_id, raw, channel)
  values (u, left(p_raw, 4000), case when p_channel in ('sms', 'email') then p_channel else 'other' end);
  return 'ok';
end $$;
revoke all on function bs_private.push(text, text, text) from public;

-- For the phone (MacroDroid): the body is the raw SMS text (Content-Type: text/plain),
-- the key and channel travel in the x-bs-key and x-bs-channel headers.
create or replace function public.bs_ingest(text)
returns text language plpgsql security definer set search_path = '' as $$
declare h json := nullif(current_setting('request.headers', true), '')::json;
begin
  return bs_private.push(h->>'x-bs-key', $1, coalesce(h->>'x-bs-channel', 'sms'));
end $$;

-- For Gmail (Apps Script) and the app's test button: JSON body {"raw": "...", "key": "...", "channel": "email"}.
-- The key and channel may come in the headers instead.
drop function if exists public.bs_add(text);
create or replace function public.bs_add(raw text, key text default null, channel text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare h json := nullif(current_setting('request.headers', true), '')::json;
begin
  return bs_private.push(coalesce(key, h->>'x-bs-key'), raw, coalesce(channel, h->>'x-bs-channel', 'email'));
end $$;

-- For the app: returns your capture key, creating it on first use; fresh => true replaces it.
create or replace function public.bs_my_key(fresh boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); k text;
begin
  if u is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if fresh then delete from public.bs_keys where user_id = u; end if;
  select key into k from public.bs_keys where user_id = u;
  if k is null then
    k := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into public.bs_keys (user_id, key) values (u, k);
  end if;
  return k;
end $$;

revoke all on function public.bs_ingest(text), public.bs_add(text, text, text), public.bs_my_key(boolean) from public;
grant execute on function public.bs_ingest(text), public.bs_add(text, text, text) to anon, authenticated;
grant execute on function public.bs_my_key(boolean) to authenticated;
