-- ============ TABLES ============
create table public.settings (
  id int primary key default 1,
  area_name text not null default 'Polder 32, Dacope, Khulna (example)',
  latitude double precision not null default 22.50,
  longitude double precision not null default 89.47,
  danger_level double precision not null default 3.4,
  drain_start double precision not null default 2.2,
  drain_stop double precision not null default 1.9,
  min_head double precision not null default 0.10,
  salinity_limit double precision not null default 2.0,
  rain_alert_3h double precision not null default 25,
  simulator_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint settings_single_row check (id = 1)
);
grant select on public.settings to anon, authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;
create policy "Anyone can view settings" on public.settings for select to anon, authenticated using (true);

create table public.sensor_readings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  h_out double precision not null,
  h_in double precision not null,
  ec_river double precision not null,
  ec_polder double precision,
  water_temp double precision,
  gate_pct double precision not null default 0,
  device_id text not null default 'esp32-01',
  is_sample boolean not null default false
);
create index sensor_readings_created_at_idx on public.sensor_readings (created_at desc);
grant select on public.sensor_readings to anon, authenticated;
grant all on public.sensor_readings to service_role;
alter table public.sensor_readings enable row level security;
create policy "Anyone can view readings" on public.sensor_readings for select to anon, authenticated using (true);

create table public.gate_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  target_pct double precision not null,
  source text not null check (source in ('auto','manual','interlock')),
  reason text not null default '',
  h_in double precision,
  h_out double precision,
  ec double precision,
  is_sample boolean not null default false
);
create index gate_events_created_at_idx on public.gate_events (created_at desc);
grant select on public.gate_events to anon, authenticated;
grant all on public.gate_events to service_role;
alter table public.gate_events enable row level security;
create policy "Anyone can view gate events" on public.gate_events for select to anon, authenticated using (true);

create table public.gate_commands (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  target_pct double precision not null,
  source text not null check (source in ('auto','manual','interlock')),
  status text not null default 'pending' check (status in ('pending','sent','acknowledged','superseded')),
  reason text not null default '',
  device_id text,
  sent_at timestamptz,
  acknowledged_at timestamptz
);
create index gate_commands_created_at_idx on public.gate_commands (created_at desc);
grant select on public.gate_commands to anon, authenticated;
grant all on public.gate_commands to service_role;
alter table public.gate_commands enable row level security;
create policy "Anyone can view gate commands" on public.gate_commands for select to anon, authenticated using (true);

create table public.rain_observations (
  id bigint generated always as identity primary key,
  observed_at timestamptz not null unique,
  rate_mm_h double precision not null default 0,
  last3h_mm double precision not null default 0,
  last24h_mm double precision not null default 0,
  is_sample boolean not null default false
);
create index rain_observations_observed_at_idx on public.rain_observations (observed_at desc);
grant select on public.rain_observations to anon, authenticated;
grant all on public.rain_observations to service_role;
alter table public.rain_observations enable row level security;
create policy "Anyone can view rain" on public.rain_observations for select to anon, authenticated using (true);

create table public.data_sources (
  source_id text primary key,
  last_synced_at timestamptz,
  newest_observation_at timestamptz,
  payload jsonb not null default '{}'::jsonb
);
grant select on public.data_sources to anon, authenticated;
grant all on public.data_sources to service_role;
alter table public.data_sources enable row level security;
create policy "Anyone can view data sources" on public.data_sources for select to anon, authenticated using (true);

create table public.gate_state (
  id int primary key default 1,
  mode text not null default 'auto' check (mode in ('auto','manual')),
  estop boolean not null default false,
  target_pct double precision not null default 0,
  engine_mode text not null default 'STANDBY',
  engine_target double precision not null default 0,
  engine_reason text not null default '',
  draining boolean not null default false,
  alert text,
  checks jsonb not null default '[]'::jsonb,
  engine_ran_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint gate_state_single_row check (id = 1)
);
grant select on public.gate_state to anon, authenticated;
grant all on public.gate_state to service_role;
alter table public.gate_state enable row level security;
create policy "Anyone can view gate state" on public.gate_state for select to anon, authenticated using (true);

-- ============ VALIDATION ============
create or replace function public.validate_settings()
returns trigger language plpgsql set search_path = public as $$
begin
  if not (new.drain_stop < new.drain_start and new.drain_start < new.danger_level) then
    raise exception 'Levels must follow: drain stop < drain start < danger level';
  end if;
  if new.min_head < 0 or new.salinity_limit <= 0 or new.rain_alert_3h <= 0 then
    raise exception 'Minimum head, salinity limit and rain alert must be positive';
  end if;
  if new.latitude < -90 or new.latitude > 90 or new.longitude < -180 or new.longitude > 180 then
    raise exception 'Latitude or longitude out of range';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger settings_validate before insert or update on public.settings
for each row execute function public.validate_settings();

-- ============ CHART HELPERS ============
create or replace function public.readings_bucketed(p_from timestamptz, p_to timestamptz, p_bucket_seconds int)
returns table(bucket timestamptz, h_out double precision, h_in double precision, ec_river double precision,
  ec_polder double precision, max_h_out double precision, max_h_in double precision, max_ec double precision,
  max_gate_pct double precision, n int)
language sql stable security invoker set search_path = public as $$
  select to_timestamp(floor(extract(epoch from r.created_at) / greatest(p_bucket_seconds,1)) * greatest(p_bucket_seconds,1)) as bucket,
    avg(r.h_out), avg(r.h_in), avg(r.ec_river), avg(r.ec_polder),
    max(r.h_out), max(r.h_in), max(r.ec_river), max(r.gate_pct), count(*)::int
  from public.sensor_readings r
  where r.created_at >= p_from and r.created_at <= p_to
  group by 1 order by 1
$$;
grant execute on function public.readings_bucketed(timestamptz, timestamptz, int) to anon, authenticated, service_role;

create or replace function public.rain_bucketed(p_from timestamptz, p_to timestamptz, p_bucket_seconds int)
returns table(bucket timestamptz, rain_mm double precision, max_rate double precision, n int)
language sql stable security invoker set search_path = public as $$
  select to_timestamp(floor(extract(epoch from o.observed_at) / greatest(p_bucket_seconds,1)) * greatest(p_bucket_seconds,1)) as bucket,
    sum(o.rate_mm_h * 0.5), max(o.rate_mm_h), count(*)::int
  from public.rain_observations o
  where o.observed_at >= p_from and o.observed_at <= p_to
  group by 1 order by 1
$$;
grant execute on function public.rain_bucketed(timestamptz, timestamptz, int) to anon, authenticated, service_role;

-- ============ REALTIME ============
alter publication supabase_realtime add table public.sensor_readings;
alter publication supabase_realtime add table public.gate_events;
alter publication supabase_realtime add table public.gate_commands;
alter publication supabase_realtime add table public.gate_state;
alter publication supabase_realtime add table public.data_sources;
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.rain_observations;

-- ============ DEFAULT ROWS ============
insert into public.settings (id) values (1);
insert into public.gate_state (id) values (1);

-- ============ SAMPLE HISTORY (30 days, marked is_sample) ============
do $$
declare
  n int := 30 * 96;
  t0 timestamptz := date_trunc('minute', now()) - interval '30 days';
  t timestamptz;
  i int;
  k int;
  hrs double precision;
  d double precision;
  amp double precision;
  surge double precision;
  hout double precision;
  hin double precision := 2.00;
  ec double precision;
  ecp double precision := 0.70;
  wt double precision;
  rate double precision;
  rain double precision[] := array_fill(0::double precision, array[n]);
  r3 double precision;
  r24 double precision;
  gate double precision := 0;
  draining boolean := false;
  start_eff double precision;
  head double precision;
  tgt double precision;
  src text;
  why text;
  manual_until int := -1;
  manual_days int[] := array[4, 11, 19, 25];
  manual_done int[] := array[]::int[];
  ev_start double precision[] := array[2.3, 5.6, 8.1, 12.4, 17.1, 21.7, 26.2];
  ev_hours double precision[] := array[4, 3, 10, 5, 2, 6, 3];
  ev_rate double precision[] := array[6, 4, 14, 8, 10, 7, 5];
  rain_cutoff timestamptz := now() - interval '4 hours';
  final_drain boolean;
begin
  perform setseed(0.42);
  for i in 1..n loop
    t := t0 + make_interval(mins => (i - 1) * 15);
    d := (i - 1) / 96.0;
    hrs := extract(epoch from t) / 3600.0;

    -- rain (mm/h) from scripted events with noise
    rate := 0;
    for k in 1..array_length(ev_start, 1) loop
      if d >= ev_start[k] and d < ev_start[k] + ev_hours[k] / 24.0 then
        rate := ev_rate[k] * (0.5 + random());
      end if;
    end loop;
    rain[i] := rate * 0.25;
    r3 := 0; r24 := 0;
    for k in greatest(1, i - 11)..i loop r3 := r3 + rain[k]; end loop;
    for k in greatest(1, i - 95)..i loop r24 := r24 + rain[k]; end loop;

    -- tide (semi-diurnal + spring/neap + diurnal inequality) and storm surge on day ~8.6
    amp := 0.85 + 0.25 * cos(2 * pi() * (d - 8.6) / 14.77);
    surge := 0.95 * exp(-least(40.0, power((d - 8.6) / 0.35, 2)));
    hout := 1.55 + amp * sin(2 * pi() * hrs / 12.42) + 0.12 * sin(2 * pi() * hrs / 24.84 + 1) + surge + (random() - 0.5) * 0.02;

    -- river salinity: dry season trend, higher at high tide, diluted by rain
    ec := 1.0 + d * 0.03 + 1.4 * greatest(0, (hout - 0.45) / 2.2) - least(0.8, 0.02 * r24) + (random() - 0.5) * 0.08;
    ec := greatest(0.3, ec);
    ecp := least(1.3, greatest(0.4, ecp + (random() - 0.5) * 0.02));
    wt := 26.5 + 1.5 * sin(2 * pi() * (hrs - 9) / 24) + (random() - 0.5) * 0.2;

    head := hin - hout;
    start_eff := 2.2 - case when r3 >= 25 then 0.15 else 0 end;
    tgt := gate; src := 'auto'; why := '';

    if hout >= 3.4 then
      tgt := 0; src := 'interlock';
      why := format('Emergency lockdown: river %s m >= danger 3.40 m', round(hout::numeric, 2));
      manual_until := -1;
    elsif manual_until >= i then
      tgt := 50; src := 'manual'; why := 'Operator: canal flushing';
    elsif manual_until = i - 1 and gate > 0 then
      tgt := 0; src := 'manual'; why := 'Operator: flushing done, closed';
      manual_until := -1;
    elsif hout > hin and ec >= 2.0 then
      tgt := 0; why := format('Saline lock: river EC %s dS/m >= 2.0, river higher than polder', round(ec::numeric, 2));
    elsif (hin >= start_eff or (draining and hin > 1.9)) and head >= 0.10 then
      tgt := 100; draining := true;
      why := format('Freshwater drainage: polder %s m, head %s m', round(hin::numeric, 2), round(head::numeric, 2));
    else
      tgt := 0;
      if draining and hin <= 1.9 then
        draining := false;
        why := format('Drain stop reached: polder %s m <= 1.90 m', round(hin::numeric, 2));
      elsif draining then
        why := format('Standby: head %s m too small, waiting for low tide', round(head::numeric, 2));
      else
        why := 'Standby: polder below drain start';
      end if;
    end if;

    -- scripted manual openings on some days at a good low tide
    if src = 'auto' and tgt = 0 and not draining and (floor(d))::int = any(manual_days)
       and not ((floor(d))::int = any(manual_done)) and head >= 0.4 and extract(hour from t) between 8 and 15 then
      manual_done := manual_done || (floor(d))::int;
      manual_until := i + 7;
      tgt := 50; src := 'manual'; why := 'Operator: canal flushing';
    end if;

    if tgt <> gate then
      insert into public.gate_events (created_at, target_pct, source, reason, h_in, h_out, ec, is_sample)
      values (t, tgt, src, why, round(hin::numeric, 3), round(hout::numeric, 3), round(ec::numeric, 3), true);
      gate := tgt;
    end if;

    insert into public.sensor_readings (created_at, h_out, h_in, ec_river, ec_polder, water_temp, gate_pct, device_id, is_sample)
    values (t, round(hout::numeric, 3), round(hin::numeric, 3), round(ec::numeric, 3), round(ecp::numeric, 3), round(wt::numeric, 2), gate, 'sample', true);

    if i % 2 = 0 and t <= rain_cutoff then
      insert into public.rain_observations (observed_at, rate_mm_h, last3h_mm, last24h_mm, is_sample)
      values (t, round(((rain[i] + rain[i - 1]) * 2)::numeric, 2), round(r3::numeric, 2), round(r24::numeric, 2), true);
    end if;

    -- polder water balance for next step
    hin := hin + 0.004 * 0.25 + 0.005 * rain[i]
      - case when gate > 0 and head > 0 then 0.08 * (gate / 100.0) * sqrt(head) * 0.25 else 0 end
      + (random() - 0.5) * 0.002;
  end loop;

  final_drain := draining;
  update public.gate_state set target_pct = gate, draining = final_drain, engine_ran_at = now(),
    engine_reason = 'Sample history loaded', updated_at = now() where id = 1;
end $$;

insert into public.data_sources (source_id, last_synced_at, newest_observation_at, payload) values
  ('esp32', (select max(created_at) from public.sensor_readings), (select max(created_at) from public.sensor_readings), '{"device_id":"sample","note":"sample data"}'),
  ('gpm_imerg', now() - interval '20 minutes', (select max(observed_at) from public.rain_observations), '{"product":"GPM_3IMERGHHE (Early Run)","mock":true}'),
  ('swot', now() - interval '2 days', now() - interval '9 days', '{"product":"SWOT L2 HR RiverSP","wse_m":1.82,"width_m":1240,"reach_id":"45242100071","mock":true}'),
  ('sentinel1', now() - interval '1 day', now() - interval '5 days', '{"product":"Sentinel-1 GRD (VV)","open_water_km2":38.4,"flooded_km2":2.1,"mock":true}'),
  ('srtm', now() - interval '30 days', '2000-02-22T00:00:00Z', '{"product":"NASADEM 1 arc-second","mean_elev_m":1.6,"min_elev_m":0.4,"max_elev_m":3.9,"polder_area_km2":64.5,"mock":true}');