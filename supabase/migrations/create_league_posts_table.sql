-- Create Enums
create type post_type as enum ('announcement', 'event');
create type cost_mode as enum ('fixed', 'split');
create type interaction_status as enum ('interested', 'not_interested');

-- Create league_posts table
create table league_posts (
    id uuid default gen_random_uuid() primary key,
    league_id uuid references leagues(id) on delete cascade not null,
    user_id uuid references profiles(id) on delete set null not null,
    type post_type not null default 'announcement',
    title text not null,
    description text,
    event_date timestamptz,
    format text,
    cost_mode cost_mode,
    cost_value numeric, -- Per person if fixed, Total if split
    max_players integer,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Create post_interactions table
create table post_interactions (
    id uuid default gen_random_uuid() primary key,
    post_id uuid references league_posts(id) on delete cascade not null,
    user_id uuid references profiles(id) on delete cascade not null,
    status interaction_status not null,
    created_at timestamptz default now() not null,
    unique(post_id, user_id) -- One interaction per user per post
);

-- Enable RLS
alter table league_posts enable row level security;
alter table post_interactions enable row level security;

-- Policies for league_posts

-- Read: Everyone can read posts if they can read the league (simplified to Public/Member logic handled by app, enforcing strictly here requires joining leagues). 
-- For simplicity and consistency with current app structure: Authenticated users can read posts.
create policy "Posts are viewable by everyone" on league_posts
    for select using (true);

-- Write: Super Admins, League Admins, Co-Admins
create policy "Admins can insert posts" on league_posts
    for insert with check (
        exists (
            select 1 from profiles
            where id = auth.uid() and role = 'super_admin'
        ) or
        exists (
            select 1 from league_members
            where league_id = league_posts.league_id
            and user_id = auth.uid()
            and role in ('admin', 'co_admin')
        )
    );

create policy "Admins can update posts" on league_posts
    for update using (
        exists (
            select 1 from profiles
            where id = auth.uid() and role = 'super_admin'
        ) or
        exists (
            select 1 from league_members
            where league_id = league_posts.league_id
            and user_id = auth.uid()
            and role in ('admin', 'co_admin')
        )
    );

create policy "Admins can delete posts" on league_posts
    for delete using (
        exists (
            select 1 from profiles
            where id = auth.uid() and role = 'super_admin'
        ) or
        exists (
            select 1 from league_members
            where league_id = league_posts.league_id
            and user_id = auth.uid()
            and role in ('admin', 'co_admin')
        )
    );

-- Policies for post_interactions

-- Read: Everyone
create policy "Interactions are viewable by everyone" on post_interactions
    for select using (true);

-- Write: Authenticated users can manage their own interactions
create policy "Users can manage their interactions" on post_interactions
    for all using (auth.uid() = user_id);
