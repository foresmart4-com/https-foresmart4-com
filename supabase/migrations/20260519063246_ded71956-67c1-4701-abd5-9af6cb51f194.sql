create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  severity text not null,
  event_type text not null,
  message text,
  context jsonb not null default '{}'::jsonb,
  user_id uuid,
  request_id text,
  fingerprint text,
  created_at timestamptz not null default now()
);
create index if not exists system_events_created_idx on public.system_events (created_at desc);
create index if not exists system_events_severity_idx on public.system_events (severity, created_at desc);
create index if not exists system_events_source_idx on public.system_events (source, created_at desc);

alter table public.system_events enable row level security;

drop policy if exists "admins read system_events" on public.system_events;
create policy "admins read system_events" on public.system_events
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "service_role manages system_events" on public.system_events;
create policy "service_role manages system_events" on public.system_events
  for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "deny client writes system_events insert" on public.system_events;
create policy "deny client writes system_events insert" on public.system_events
  as restrictive for insert to anon, authenticated with check (false);
drop policy if exists "deny client writes system_events update" on public.system_events;
create policy "deny client writes system_events update" on public.system_events
  as restrictive for update to anon, authenticated using (false) with check (false);
drop policy if exists "deny client writes system_events delete" on public.system_events;
create policy "deny client writes system_events delete" on public.system_events
  as restrictive for delete to anon, authenticated using (false);

create table if not exists public.alerts_fired (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null,
  severity text not null,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  notified boolean not null default false,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists alerts_fired_created_idx on public.alerts_fired (created_at desc);
create index if not exists alerts_fired_rule_idx on public.alerts_fired (rule_key, created_at desc);

alter table public.alerts_fired enable row level security;

drop policy if exists "admins read alerts_fired" on public.alerts_fired;
create policy "admins read alerts_fired" on public.alerts_fired
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "service_role manages alerts_fired" on public.alerts_fired;
create policy "service_role manages alerts_fired" on public.alerts_fired
  for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "admins ack alerts_fired" on public.alerts_fired;
create policy "admins ack alerts_fired" on public.alerts_fired
  for update to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.system_health_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin required';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'events_24h', jsonb_build_object(
      'total',    (select count(*) from public.system_events where created_at > now() - interval '24 hours'),
      'errors',   (select count(*) from public.system_events where created_at > now() - interval '24 hours' and severity in ('error','critical')),
      'critical', (select count(*) from public.system_events where created_at > now() - interval '24 hours' and severity = 'critical')
    ),
    'by_source_24h', (
      select coalesce(jsonb_object_agg(source, c), '{}'::jsonb)
      from (
        select source, count(*) c from public.system_events
        where created_at > now() - interval '24 hours' group by source
      ) s
    ),
    'email_24h', jsonb_build_object(
      'sent',      (select count(*) from public.resend_email_log where status = 'sent'    and created_at > now() - interval '24 hours'),
      'failed',    (select count(*) from public.resend_email_log where status = 'failed'  and created_at > now() - interval '24 hours'),
      'pending',   (select count(*) from public.resend_email_log where status = 'pending' and created_at > now() - interval '24 hours')
    ),
    'auth_24h', jsonb_build_object(
      'signins',       (select count(*) from public.auth_events where event_type='signin'        and created_at > now() - interval '24 hours'),
      'signin_failed', (select count(*) from public.auth_events where event_type='signin_failed' and created_at > now() - interval '24 hours'),
      'signups',       (select count(*) from public.auth_events where event_type='signup'        and created_at > now() - interval '24 hours'),
      'signup_failed', (select count(*) from public.auth_events where event_type='signup_failed' and created_at > now() - interval '24 hours')
    ),
    'open_alerts', (select count(*) from public.alerts_fired where acknowledged_at is null and created_at > now() - interval '7 days')
  ) into result;

  return result;
end;
$$;

revoke all on function public.system_health_snapshot() from public, anon, authenticated;
grant execute on function public.system_health_snapshot() to authenticated;