-- À exécuter dans Supabase > SQL Editor
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  pin_hash text
);
create table items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  parent_id uuid references items(id) on delete cascade,
  kind text not null default 'task' check (kind in ('task','project','goal')),
  title text not null,
  notes text default '',
  done boolean default false,
  due_date date,
  is_private boolean default false,
  created_at timestamptz default now()
);
create index on items(user_id, is_private);
-- RLS activé sans policy : seul le backend (service key) accède aux données.
alter table profiles enable row level security;
alter table items enable row level security;
