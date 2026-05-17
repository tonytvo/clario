-- ============================================================
-- Clario database schema
-- Run: supabase db push  (or npm run db:migrate)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Profiles (extends auth.users) ────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  -- which cloud storage provider the user has connected
  storage_provider text check (storage_provider in ('google_drive', 'dropbox', 'none')) default 'none',
  created_at   timestamptz default now()
);

-- ── Groups ───────────────────────────────────────────────────
create table public.groups (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  currency    text not null default 'CAD',
  created_at  timestamptz default now()
);

-- ── Group members ────────────────────────────────────────────
create table public.group_members (
  group_id   uuid references public.groups(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  role       text check (role in ('admin', 'member')) default 'member',
  joined_at  timestamptz default now(),
  primary key (group_id, user_id)
);

-- ── Expenses ─────────────────────────────────────────────────
create table public.expenses (
  id          uuid primary key default uuid_generate_v4(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  title       text not null,
  amount      numeric(12, 2) not null check (amount > 0),
  currency    text not null default 'CAD',
  category    text,
  paid_by     uuid not null references public.profiles(id) on delete restrict,
  date        date not null default current_date,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── Expense splits ───────────────────────────────────────────
create table public.expense_splits (
  id          uuid primary key default uuid_generate_v4(),
  expense_id  uuid not null references public.expenses(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete restrict,
  amount      numeric(12, 2) not null check (amount >= 0),
  settled     boolean not null default false,
  settled_at  timestamptz,
  unique (expense_id, user_id)
);

-- ── Receipt links (user owns the file, we store the link) ────
create table public.receipt_links (
  id               uuid primary key default uuid_generate_v4(),
  expense_id       uuid not null references public.expenses(id) on delete cascade,
  uploaded_by      uuid not null references public.profiles(id) on delete restrict,
  -- The raw share URL (Google Drive, Dropbox, etc.)
  url              text not null,
  -- Derived embed URL (e.g. /preview instead of /view for Drive)
  embed_url        text,
  provider         text check (provider in ('google_drive', 'dropbox', 'url')) not null,
  filename         text,
  created_at       timestamptz default now()
);

-- ── Settlements ──────────────────────────────────────────────
create table public.settlements (
  id           uuid primary key default uuid_generate_v4(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  from_user    uuid not null references public.profiles(id) on delete restrict,
  to_user      uuid not null references public.profiles(id) on delete restrict,
  amount       numeric(12, 2) not null check (amount > 0),
  currency     text not null default 'CAD',
  note         text,
  settled_at   timestamptz default now()
);

-- ── Triggers: updated_at ─────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ── Trigger: auto-create profile on signup ───────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════
-- Row Level Security
-- Users can only see data for groups they belong to.
-- ════════════════════════════════════════════════════════════

alter table public.profiles       enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;
alter table public.receipt_links  enable row level security;
alter table public.settlements    enable row level security;

-- Helper: is the current user a member of a group?
create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- Profiles: readable by anyone in a shared group, writable by self
create policy "profiles: read own or shared group" on public.profiles
  for select using (
    id = auth.uid() or
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
    )
  );

create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid());

-- Groups: visible to members only
create policy "groups: members can read" on public.groups
  for select using (public.is_group_member(id));

create policy "groups: authenticated can create" on public.groups
  for insert with check (auth.uid() is not null);

create policy "groups: admin can update" on public.groups
  for update using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id and user_id = auth.uid() and role = 'admin'
    )
  );

-- Group members
create policy "group_members: members can read" on public.group_members
  for select using (public.is_group_member(group_id));

create policy "group_members: admin can insert" on public.group_members
  for insert with check (
    exists (
      select 1 from public.group_members
      where group_id = group_members.group_id and user_id = auth.uid() and role = 'admin'
    ) or not exists (
      select 1 from public.group_members where group_id = group_members.group_id
    )
  );

-- Expenses
create policy "expenses: group members can read" on public.expenses
  for select using (public.is_group_member(group_id));

create policy "expenses: group members can insert" on public.expenses
  for insert with check (public.is_group_member(group_id));

create policy "expenses: paid_by or admin can update" on public.expenses
  for update using (
    paid_by = auth.uid() or
    exists (
      select 1 from public.group_members
      where group_id = expenses.group_id and user_id = auth.uid() and role = 'admin'
    )
  );

-- Expense splits
create policy "splits: group members can read" on public.expense_splits
  for select using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and public.is_group_member(e.group_id)
    )
  );

create policy "splits: group members can insert" on public.expense_splits
  for insert with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and public.is_group_member(e.group_id)
    )
  );

-- Receipt links
create policy "receipts: group members can read" on public.receipt_links
  for select using (
    exists (
      select 1 from public.expenses e
      where e.id = receipt_links.expense_id and public.is_group_member(e.group_id)
    )
  );

create policy "receipts: uploader or group member can insert" on public.receipt_links
  for insert with check (
    uploaded_by = auth.uid() and
    exists (
      select 1 from public.expenses e
      where e.id = receipt_links.expense_id and public.is_group_member(e.group_id)
    )
  );

-- Settlements
create policy "settlements: group members can read" on public.settlements
  for select using (public.is_group_member(group_id));

create policy "settlements: group members can insert" on public.settlements
  for insert with check (public.is_group_member(group_id) and from_user = auth.uid());
