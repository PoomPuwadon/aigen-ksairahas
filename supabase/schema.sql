-- ============================================================================
-- BigBro / LilBro Code-Name Game — full Supabase schema
-- ============================================================================
-- Run this once in a fresh Supabase project's SQL Editor. It creates every
-- table and RPC function the frontend needs, with Row Level Security enabled
-- and intentionally NO policies defined on any table.
--
-- Why no policies? All real access control lives in the SECURITY DEFINER
-- functions below (they run with the function owner's privileges and bypass
-- RLS). RLS-enabled + zero policies means PostgREST (and therefore the
-- public anon key) gets a hard "deny all" on direct table access — the only
-- way in or out is through these vetted functions. Do not add permissive
-- policies to these tables unless you also remove the equivalent logic from
-- its function, or you'll end up with two different, possibly inconsistent,
-- paths to the same data.
--
-- Known design note (read before you deploy): logging in as a lilbro is just
-- a first-name lookup (get_lilbro_hints) — there's no password. That's a
-- deliberate low-friction choice for a fun campus icebreaker, not a bug, but
-- it means anyone who knows (or guesses) another lilbro's first name can
-- view their hints and act as them. Don't use this schema for anything where
-- that matters.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

-- Both bigbros (usertype = 0) and lilbros (usertype = 1) live in one table.
-- linked_id on a lilbro row points at the nickname of their real bigbro.
create table public.users (
  id serial primary key,
  usertype smallint not null,             -- 0 = bigbro, 1 = lilbro
  nickname text not null unique,
  linked_id text references public.users (nickname),
  hint1 text,
  hint2 text,
  hint3 text,
  first_name text,
  branch text,
  real_bigbro_first_name text,
  access_token uuid not null default gen_random_uuid()
);

-- A lilbro's current guess at who their bigbro is. One row per lilbro.
create table public.guesses (
  lilbro_nickname text primary key references public.users (nickname),
  guessed_bigbro_first_name text not null,
  guessed_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Key/value store for event timing. Expected keys used by the app:
--   guess_open_date, guess_reveal_date, hint2_date, hint3_date
create table public.event_config (
  config_key text primary key,
  reveal_date timestamptz not null
);

-- Single-row table holding the admin password hash (bcrypt via pgcrypto).
create table public.admin_auth (
  id integer primary key default 1,
  password_hash text not null,
  constraint admin_auth_single_row check (id = 1)
);

-- Admin sessions expire after 12 hours (enforced in is_admin_session_valid).
create table public.admin_sessions (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Optional hidden easter-egg: a secret keyword (hashed) typed into the login
-- field triggers a full-screen takeover. Leave this table empty to disable.
create table public.betsim_keywords (
  id serial primary key,
  keyword_hash text not null
);

-- Aggregate vote counts, one row per photo/round.
create table public.photo_votes (
  photo_id integer primary key,
  hod_votes integer not null default 0,
  meun_votes integer not null default 0
);

-- Per-user vote record, prevents double voting on the same photo.
create table public.photo_vote_choices (
  nickname text not null,
  photo_id integer not null references public.photo_votes (photo_id),
  choice text not null check (choice in ('hod', 'meun')),
  voted_at timestamptz not null default now(),
  primary key (nickname, photo_id)
);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY — enabled everywhere, no policies. See note at top.
-- ----------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.guesses enable row level security;
alter table public.event_config enable row level security;
alter table public.admin_auth enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.betsim_keywords enable row level security;
alter table public.photo_votes enable row level security;
alter table public.photo_vote_choices enable row level security;

-- ----------------------------------------------------------------------------
-- FUNCTIONS
-- ----------------------------------------------------------------------------

create or replace function public.is_admin_session_valid(p_token uuid)
 returns boolean
 language sql
 security definer
as $function$
  select exists (
    select 1 from admin_sessions
    where token = p_token and created_at > now() - interval '12 hours'
  );
$function$;

create or replace function public.admin_login(p_password text)
 returns uuid
 language plpgsql
 security definer
as $function$
declare
    v_hash text;
    v_token uuid;
begin
    select password_hash into v_hash from admin_auth where id = 1;
    if v_hash is null or crypt(p_password, v_hash) != v_hash then
        raise exception 'invalid password';
    end if;

    insert into admin_sessions (token) values (gen_random_uuid()) returning token into v_token;
    return v_token;
end;
$function$;

create or replace function public.admin_get_summary(p_admin_token uuid)
 returns jsonb
 language plpgsql
 security definer
as $function$
declare
    v_result jsonb;
    v_reveal_date timestamptz;
    v_is_revealed boolean;
begin
    if not is_admin_session_valid(p_admin_token) then
        raise exception 'unauthorized';
    end if;

    select reveal_date into v_reveal_date from event_config where config_key = 'guess_reveal_date';
    v_is_revealed := v_reveal_date is not null and now() >= v_reveal_date;

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'bigbro_first_name', bb.first_name,
            'bigbro_branch', bb.branch,
            'any_guessed', exists (
                select 1 from users l
                join guesses g on g.lilbro_nickname = l.nickname
                where l.linked_id = bb.nickname and l.usertype = 1
            ),
            'group_correct', exists (
                select 1 from users l
                join guesses g on g.lilbro_nickname = l.nickname
                where l.linked_id = bb.nickname
                  and l.usertype = 1
                  and g.guessed_bigbro_first_name = bb.first_name
            ),
            'lilbros', (
                select coalesce(jsonb_agg(
                    jsonb_build_object(
                        'nickname', l.nickname,
                        'guess', g.guessed_bigbro_first_name,
                        'is_correct', (g.guessed_bigbro_first_name = bb.first_name)
                    ) order by l.nickname
                ), '[]'::jsonb)
                from users l
                left join guesses g on g.lilbro_nickname = l.nickname
                where l.linked_id = bb.nickname and l.usertype = 1
            )
        ) order by bb.branch, bb.first_name
    ), '[]'::jsonb) into v_result
    from users bb
    where bb.usertype = 0;

    return jsonb_build_object('is_revealed', v_is_revealed, 'groups', v_result);
end;
$function$;

create or replace function public.admin_update_dates(
    p_admin_token uuid,
    p_guess_open timestamptz,
    p_guess_reveal timestamptz
)
 returns void
 language plpgsql
 security definer
as $function$
begin
    if not is_admin_session_valid(p_admin_token) then
        raise exception 'unauthorized';
    end if;

    update event_config set reveal_date = p_guess_open where config_key = 'guess_open_date';
    update event_config set reveal_date = p_guess_reveal where config_key = 'guess_reveal_date';
end;
$function$;

create or replace function public.cast_photo_vote(p_token uuid, p_photo_id integer, p_choice text)
 returns jsonb
 language plpgsql
 security definer
as $function$
declare
    v_nickname text;
    v_hod int;
    v_meun int;
begin
    if p_choice not in ('hod', 'meun') then
        raise exception 'invalid choice';
    end if;

    select nickname into v_nickname from users where access_token = p_token and usertype = 1;
    if v_nickname is null then
        raise exception 'invalid session';
    end if;

    if exists (select 1 from photo_vote_choices where nickname = v_nickname and photo_id = p_photo_id) then
        select hod_votes, meun_votes into v_hod, v_meun from photo_votes where photo_id = p_photo_id;
        return jsonb_build_object('hod_votes', v_hod, 'meun_votes', v_meun, 'already_voted', true);
    end if;

    insert into photo_vote_choices (nickname, photo_id, choice) values (v_nickname, p_photo_id, p_choice);

    if p_choice = 'hod' then
        update photo_votes pv set hod_votes = pv.hod_votes + 1 where pv.photo_id = p_photo_id;
    else
        update photo_votes pv set meun_votes = pv.meun_votes + 1 where pv.photo_id = p_photo_id;
    end if;

    select hod_votes, meun_votes into v_hod, v_meun from photo_votes pv where pv.photo_id = p_photo_id;
    return jsonb_build_object('hod_votes', v_hod, 'meun_votes', v_meun, 'already_voted', false);
end;
$function$;

create or replace function public.get_vote_state(p_token uuid, p_photo_id integer)
 returns jsonb
 language plpgsql
 security definer
as $function$
declare
    v_nickname text;
    v_choice text;
    v_hod int;
    v_meun int;
begin
    select nickname into v_nickname from users where access_token = p_token and usertype = 1;
    if v_nickname is null then
        raise exception 'invalid session';
    end if;

    select choice into v_choice from photo_vote_choices where nickname = v_nickname and photo_id = p_photo_id;
    select hod_votes, meun_votes into v_hod, v_meun from photo_votes where photo_id = p_photo_id;

    return jsonb_build_object(
        'my_choice', v_choice,
        'hod_votes', coalesce(v_hod, 0),
        'meun_votes', coalesce(v_meun, 0)
    );
end;
$function$;

-- Easter-egg keyword check for the hidden betsim takeover. No auth needed —
-- it only ever returns a boolean, never any keyword content. Note there's no
-- rate limiting here; treat this purely as a fun extra, not a real secret gate.
create or replace function public.check_betsim_keyword(p_text text)
 returns boolean
 language plpgsql
 security definer
as $function$
declare
    v_hash text;
begin
    for v_hash in select keyword_hash from betsim_keywords loop
        if crypt(p_text, v_hash) = v_hash then
            return true;
        end if;
    end loop;
    return false;
end;
$function$;

create or replace function public.get_guess_phase()
 returns jsonb
 language plpgsql
 security definer
as $function$
declare
    v_open timestamptz;
    v_reveal timestamptz;
    v_now timestamptz := now();
    v_phase text;
begin
    select reveal_date into v_open from event_config where config_key = 'guess_open_date';
    select reveal_date into v_reveal from event_config where config_key = 'guess_reveal_date';

    if v_open is null or v_reveal is null then
        raise exception 'guess_open_date / guess_reveal_date not set in event_config';
    end if;

    if v_now < v_open then
        v_phase := 'not_open';
    elsif v_now >= v_reveal then
        v_phase := 'revealed';
    else
        v_phase := 'guessing';
    end if;

    return jsonb_build_object(
        'phase', v_phase,
        'guess_open_date', v_open,
        'guess_reveal_date', v_reveal,
        'server_time', v_now
    );
end;
$function$;

-- Acts as the "login" for a lilbro: looks them up by first name and returns
-- their session access_token plus their (possibly time-locked) hints.
-- No password — see the design note at the top of this file.
create or replace function public.get_lilbro_hints(p_first_name text)
 returns table(nickname text, first_name text, branch text, hint1 text, hint2 text, hint3 text, access_token uuid)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
    v_hint2_date timestamptz;
    v_hint3_date timestamptz;
    v_now timestamptz := clock_timestamp();
begin
    select reveal_date into v_hint2_date from event_config where config_key = 'hint2_date';
    select reveal_date into v_hint3_date from event_config where config_key = 'hint3_date';

    if v_hint2_date is null or v_hint3_date is null then
        raise exception 'hint2_date / hint3_date not set in event_config';
    end if;

    return query
    select
        l.nickname, l.first_name, l.branch,
        coalesce(b.hint1, l.hint1),
        case when coalesce(b.hint2, l.hint2) is null or coalesce(b.hint2, l.hint2) = '' then null
             when v_now >= v_hint2_date then coalesce(b.hint2, l.hint2)
             else 'LOCKED:' || to_char(v_hint2_date at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
        case when coalesce(b.hint3, l.hint3) is null or coalesce(b.hint3, l.hint3) = '' then null
             when v_now >= v_hint3_date then coalesce(b.hint3, l.hint3)
             else 'LOCKED:' || to_char(v_hint3_date at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
        l.access_token
    from users l
    left join lateral (
        select bb.hint1, bb.hint2, bb.hint3
        from users bb
        where bb.usertype = 0
          and (trim(l.linked_id) = trim(bb.first_name) or trim(l.linked_id) = trim(bb.nickname))
        order by case when trim(l.linked_id) = trim(bb.first_name) then 0 else 1 end
        limit 1
    ) b on true
    where l.first_name = p_first_name and l.usertype = 1
    limit 1;
end;
$function$;

-- Token-checked. (An older tokenless overload existed during development and
-- has been intentionally left out of this schema — see README's security notes.)
create or replace function public.get_my_guess(p_lilbro_nickname text, p_token uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
    v_guess text;
    v_linked_id text;
begin
    if not exists (
        select 1 from users where nickname = p_lilbro_nickname and access_token = p_token and usertype = 1
    ) then
        return null;
    end if;

    select g.guessed_bigbro_first_name, l.linked_id
    into v_guess, v_linked_id
    from public.users l
    left join public.guesses g on g.lilbro_nickname = l.nickname
    where l.nickname = p_lilbro_nickname and l.usertype = 1
    limit 1;

    if v_linked_id is null then
        return null;
    end if;

    return jsonb_build_object(
        'guess', v_guess,
        'group_guesses', (
            select coalesce(jsonb_agg(
                jsonb_build_object('nickname', u.nickname, 'guess', g.guessed_bigbro_first_name)
                order by u.nickname
            ), '[]'::jsonb)
            from public.users u
            left join public.guesses g on g.lilbro_nickname = u.nickname
            where u.linked_id = v_linked_id and u.usertype = 1
        )
    );
end;
$function$;

-- Token-checked. (See note on get_my_guess above — same cleanup applied here.)
create or replace function public.get_reveal(p_lilbro_nickname text, p_token uuid)
 returns jsonb
 language plpgsql
 security definer
as $function$
declare
    v_linked_id text;
    v_real_bigbro_first_name text;
    v_real_bigbro_branch text;
    v_is_correct boolean := false;
    v_result jsonb;
    v_reveal_date timestamptz;
begin
    if not exists (
        select 1 from users where nickname = p_lilbro_nickname and access_token = p_token and usertype = 1
    ) then
        raise exception 'ไม่ได้รับอนุญาต (invalid session)';
    end if;

    select reveal_date into v_reveal_date from event_config where config_key = 'guess_reveal_date';
    if v_reveal_date is not null and now() < v_reveal_date then
        raise exception 'ยังไม่ถึงเวลาเฉลยครับน้อง';
    end if;

    select linked_id into v_linked_id from users where nickname = p_lilbro_nickname limit 1;

    if v_linked_id is not null then
        select first_name, branch into v_real_bigbro_first_name, v_real_bigbro_branch
        from users where nickname = v_linked_id and usertype = 0 limit 1;
    end if;

    if v_real_bigbro_first_name is not null then
        select exists (
            select 1 from guesses g
            join users u on g.lilbro_nickname = u.nickname
            where u.linked_id = v_linked_id and g.guessed_bigbro_first_name = v_real_bigbro_first_name
        ) into v_is_correct;
    end if;

    -- Punishment text is a plain literal here for simplicity. If you'd rather
    -- make it editable without a redeploy, move it into event_config and
    -- read it the same way guess_open_date/guess_reveal_date are read above.
    select jsonb_build_object(
        'is_correct', v_is_correct,
        'real_bigbro_first_name', coalesce(v_real_bigbro_first_name, 'error'),
        'real_bigbro_branch', v_real_bigbro_branch,
        'punishment', 'บทลงโทษ: ถ่ายคลิปกับพี่รหัส ตะโกนว่า "ผมรักกรุ๊ปK" ลง Story (คนที่อยู่ร้านห้ามบิด)'
    ) into v_result;

    return v_result;
end;
$function$;

create or replace function public.list_bigbros()
 returns jsonb
 language plpgsql
 security definer
as $function$
declare
    v_open timestamptz;
    v_now timestamptz := now();
begin
    select reveal_date into v_open from event_config where config_key = 'guess_open_date';

    if v_open is null or v_now < v_open then
        raise exception 'Guessing phase has not started yet.';
    end if;

    return (
        select coalesce(jsonb_agg(jsonb_build_object(
            'first_name', first_name,
            'branch', branch
        )), '[]'::jsonb)
        from users
        where usertype = 0
    );
end;
$function$;

create or replace function public.search_lilbro_nicknames(prefix text)
 returns table(id integer, nickname text, first_name text, branch text)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select id, nickname, first_name, branch
  from users
  where usertype = 1
    and (nickname ilike prefix || '%' or first_name ilike prefix || '%')
  order by nickname, first_name
  limit 8;
$function$;

-- Token-checked. (See note on get_my_guess above — same cleanup applied here.)
create or replace function public.submit_guess(
    p_lilbro_nickname text,
    p_bigbro_first_name text,
    p_token uuid
)
 returns jsonb
 language plpgsql
 security definer
as $function$
declare
    v_user_linked_id text;
    v_result jsonb;
    v_reveal_date timestamptz;
begin
    if not exists (
        select 1 from users where nickname = p_lilbro_nickname and access_token = p_token and usertype = 1
    ) then
        raise exception 'ไม่ได้รับอนุญาต (invalid session)';
    end if;

    select reveal_date into v_reveal_date from event_config where config_key = 'guess_reveal_date';
    if v_reveal_date is not null and now() >= v_reveal_date then
        raise exception 'หมดเวลาทายแล้ว! (Guessing phase has ended)';
    end if;

    select linked_id into v_user_linked_id from users where nickname = p_lilbro_nickname limit 1;

    insert into guesses (lilbro_nickname, guessed_bigbro_first_name, updated_at)
    values (p_lilbro_nickname, p_bigbro_first_name, now())
    on conflict (lilbro_nickname)
    do update set guessed_bigbro_first_name = excluded.guessed_bigbro_first_name, updated_at = now();

    select jsonb_build_object(
        'user_guess', p_bigbro_first_name,
        'group_guesses', (
            select jsonb_agg(jsonb_build_object('nickname', u.nickname, 'guess', g.guessed_bigbro_first_name))
            from users u
            left join guesses g on u.nickname = g.lilbro_nickname
            where u.linked_id is not null and u.linked_id = v_user_linked_id
        )
    ) into v_result;

    return v_result;
end;
$function$;

-- ----------------------------------------------------------------------------
-- INITIAL DATA — required before the app works. Edit and run these manually.
-- ----------------------------------------------------------------------------

-- 1) Admin password. Pick a real password and replace 'change-me' below.
-- insert into public.admin_auth (id, password_hash) values (1, crypt('change-me', gen_salt('bf')));

-- 2) Event timing. All four keys are required — get_guess_phase and
--    get_lilbro_hints both raise an error until these exist.
-- insert into public.event_config (config_key, reveal_date) values
--   ('hint2_date',       '2026-01-01 12:00:00+07'),
--   ('hint3_date',       '2026-01-08 12:00:00+07'),
--   ('guess_open_date',  '2026-01-15 12:00:00+07'),
--   ('guess_reveal_date','2026-01-20 12:00:00+07');

-- 3) At least one photo_votes row for the photo-vote screen (VOTE_PHOTO_ID
--    in src/theme.js must match the photo_id you insert here).
-- insert into public.photo_votes (photo_id, hod_votes, meun_votes) values (1, 0, 0);

-- 4) (Optional) betsim easter-egg keyword.
-- insert into public.betsim_keywords (keyword_hash) values (crypt('your-secret-word', gen_salt('bf')));

-- 5) Populate public.users with your actual bigbros/lilbros — either by hand,
--    or via the Google Apps Script bulk importer in google-apps-script/.
