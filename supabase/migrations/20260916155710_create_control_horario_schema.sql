create schema if not exists private;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, name)
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'supervisor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table public.worksites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 180),
  address text not null default '',
  latitude numeric(9,6),
  longitude numeric(9,6),
  geofence_radius_m integer check (geofence_radius_m is null or geofence_radius_m between 10 and 5000),
  timezone text not null default 'Europe/Madrid',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null check (char_length(last_name) between 1 and 160),
  document_number text,
  role text not null default 'Trabajador',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (company_id, document_number)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  worksite_id uuid not null references public.worksites(id) on delete restrict,
  starts_on date not null,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  unique (worker_id, worksite_id, starts_on)
);

create table public.clock_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  worksite_id uuid not null references public.worksites(id) on delete restrict,
  event_type text not null check (event_type in ('entry', 'pause', 'resume', 'exit')),
  occurred_at timestamptz not null default now(),
  client_occurred_at timestamptz,
  received_at timestamptz not null default now(),
  timezone text not null default 'Europe/Madrid',
  latitude numeric(9,6),
  longitude numeric(9,6),
  accuracy_m numeric(8,2),
  location_status text not null default 'not_requested'
    check (location_status in ('captured', 'denied', 'unavailable', 'not_requested')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  previous_hash text,
  integrity_hash text not null,
  source text not null default 'mobile' check (source in ('mobile', 'offline_sync', 'supervisor_correction')),
  created_at timestamptz not null default now(),
  unique (worker_id, idempotency_key)
);

create table public.clock_event_corrections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  original_event_id uuid not null references public.clock_events(id) on delete restrict,
  requested_by_worker_id uuid references public.workers(id) on delete restrict,
  resolved_by_user_id uuid references auth.users(id) on delete restrict,
  requested_event_type text check (requested_event_type is null or requested_event_type in ('entry', 'pause', 'resume', 'exit')),
  requested_occurred_at timestamptz,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolution_note text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((status = 'pending' and resolved_at is null) or (status in ('approved', 'rejected') and resolved_at is not null))
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  actor_type text not null check (actor_type in ('user', 'worker', 'system')),
  actor_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table private.worker_credentials (
  worker_id uuid primary key references public.workers(id) on delete cascade,
  pin_hash text not null,
  pin_salt text not null,
  updated_at timestamptz not null default now()
);

create table private.worker_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table private.worker_sessions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table private.activation_attempts (
  key text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  window_started_at timestamptz not null,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index worksites_company_idx on public.worksites(company_id);
create index workers_company_idx on public.workers(company_id);
create index assignments_worker_idx on public.assignments(worker_id, starts_on desc);
create index assignments_worksite_idx on public.assignments(worksite_id, starts_on desc);
create index clock_events_worker_time_idx on public.clock_events(worker_id, occurred_at desc);
create index clock_events_company_time_idx on public.clock_events(company_id, occurred_at desc);
create index corrections_company_status_idx on public.clock_event_corrections(company_id, status, requested_at desc);
create index audit_company_time_idx on public.audit_log(company_id, created_at desc);
create index invitations_worker_idx on private.worker_invitations(worker_id, created_at desc);
create index sessions_worker_idx on private.worker_sessions(worker_id, expires_at desc);

create or replace function private.user_can_access_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.companies c
      where c.id = target_company_id and c.owner_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.company_members m
      where m.company_id = target_company_id and m.user_id = (select auth.uid())
    )
  );
$$;

create or replace function private.user_can_manage_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.companies c
      where c.id = target_company_id and c.owner_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.company_members m
      where m.company_id = target_company_id
        and m.user_id = (select auth.uid())
        and m.role in ('admin', 'supervisor')
    )
  );
$$;

revoke all on function private.user_can_access_company(uuid) from public;
revoke all on function private.user_can_manage_company(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.user_can_access_company(uuid) to authenticated;
grant execute on function private.user_can_manage_company(uuid) to authenticated;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.worksites enable row level security;
alter table public.workers enable row level security;
alter table public.assignments enable row level security;
alter table public.clock_events enable row level security;
alter table public.clock_event_corrections enable row level security;
alter table public.audit_log enable row level security;

create policy companies_select on public.companies for select to authenticated
using (private.user_can_access_company(id));
create policy companies_insert on public.companies for insert to authenticated
with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
create policy companies_update on public.companies for update to authenticated
using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));

create policy members_select on public.company_members for select to authenticated
using (private.user_can_access_company(company_id));
create policy members_insert on public.company_members for insert to authenticated
with check (private.user_can_manage_company(company_id));
create policy members_update on public.company_members for update to authenticated
using (private.user_can_manage_company(company_id)) with check (private.user_can_manage_company(company_id));
create policy members_delete on public.company_members for delete to authenticated
using (private.user_can_manage_company(company_id));

create policy worksites_select on public.worksites for select to authenticated
using (private.user_can_access_company(company_id));
create policy worksites_insert on public.worksites for insert to authenticated
with check (private.user_can_manage_company(company_id));
create policy worksites_update on public.worksites for update to authenticated
using (private.user_can_manage_company(company_id)) with check (private.user_can_manage_company(company_id));

create policy workers_select on public.workers for select to authenticated
using (private.user_can_access_company(company_id));
create policy workers_insert on public.workers for insert to authenticated
with check (private.user_can_manage_company(company_id));
create policy workers_update on public.workers for update to authenticated
using (private.user_can_manage_company(company_id)) with check (private.user_can_manage_company(company_id));

create policy assignments_select on public.assignments for select to authenticated
using (private.user_can_access_company(company_id));
create policy assignments_insert on public.assignments for insert to authenticated
with check (private.user_can_manage_company(company_id));
create policy assignments_update on public.assignments for update to authenticated
using (private.user_can_manage_company(company_id)) with check (private.user_can_manage_company(company_id));

create policy events_select on public.clock_events for select to authenticated
using (private.user_can_access_company(company_id));

create policy corrections_select on public.clock_event_corrections for select to authenticated
using (private.user_can_access_company(company_id));
create policy corrections_insert on public.clock_event_corrections for insert to authenticated
with check (private.user_can_manage_company(company_id));
create policy corrections_update on public.clock_event_corrections for update to authenticated
using (private.user_can_manage_company(company_id)) with check (private.user_can_manage_company(company_id));

create policy audit_select on public.audit_log for select to authenticated
using (private.user_can_access_company(company_id));

grant select, insert, update on public.companies to authenticated;
grant select, insert, update, delete on public.company_members to authenticated;
grant select, insert, update on public.worksites to authenticated;
grant select, insert, update on public.workers to authenticated;
grant select, insert, update on public.assignments to authenticated;
grant select on public.clock_events to authenticated;
grant select, insert, update on public.clock_event_corrections to authenticated;
grant select on public.audit_log to authenticated;

revoke all on all tables in schema private from anon, authenticated;
revoke all on public.clock_events from anon;
revoke all on public.audit_log from anon;

create or replace function private.reject_immutable_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'immutable_record';
end;
$$;

create trigger clock_events_immutable
before update or delete on public.clock_events
for each row execute function private.reject_immutable_change();

create trigger audit_log_immutable
before update or delete on public.audit_log
for each row execute function private.reject_immutable_change();

comment on table public.clock_events is 'Append-only original time clock events. Corrections are stored separately.';
comment on schema private is 'Server-only credentials, invitations, sessions, and abuse-prevention data.';
