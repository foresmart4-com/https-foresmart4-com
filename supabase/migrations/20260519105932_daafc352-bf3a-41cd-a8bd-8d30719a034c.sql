
create table if not exists public.provider_health_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null default 'finnhub',
  status text not null,
  stale_state text,
  avg_latency_ms integer,
  error_rate numeric,
  rate_limited integer not null default 0,
  last_success_age_s integer,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_provider_health_user_time
  on public.provider_health_log(user_id, recorded_at desc);

alter table public.provider_health_log enable row level security;

create policy "users read own provider health"
  on public.provider_health_log for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "service_role manages provider health"
  on public.provider_health_log for all to public
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "deny client inserts provider health"
  on public.provider_health_log as restrictive for insert to anon, authenticated
  with check (false);

create policy "deny client updates provider health"
  on public.provider_health_log as restrictive for update to anon, authenticated
  using (false) with check (false);

create policy "deny client deletes provider health"
  on public.provider_health_log as restrictive for delete to anon, authenticated
  using (false);
