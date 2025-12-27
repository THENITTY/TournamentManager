-- Create a table for public profiles (linked to auth.users)
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  first_name text not null,
  last_name text not null,
  avatar_url text,
  role text not null default 'user' check (role in ('super_admin', 'league_admin', 'user')),
  status text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  
  primary key (id)
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- POLICY 1: Public Read (Users can read their own profile)
create policy "Users can view own profile"
on public.profiles for select
using ( auth.uid() = id );

-- POLICY 2: Super Admin Access (Read All)
create policy "Super Admins can view all profiles"
on public.profiles for select
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
);

-- POLICY 3: Super Admin Access (Update All)
create policy "Super Admins can update all profiles"
on public.profiles for update
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
);

-- POLICY 4: Insert (Allow users to insert their *own* profile during sign up)
create policy "Users can insert their own profile"
on public.profiles for insert
with check ( auth.uid() = id );

-- Optional: Create a trigger to handle new user registration automatically?
-- For now, we will handle insertion via the frontend code to ensure First/Last name is captured.
-- But a handle_new_user function is often cleaner. 
-- START_STRICT_MODE: "Manually approves ALL new registrations." -> Trigger might be too auto.
-- We stick to explicit insert from frontend.
