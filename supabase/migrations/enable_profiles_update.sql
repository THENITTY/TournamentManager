-- Drop policies if they exist to avoid conflicts
drop policy if exists "Users can update their own profile" on "public"."profiles";
drop policy if exists "Users can insert their own profile" on "public"."profiles";

-- Enable update for users on their own profile
create policy "Users can update their own profile"
on "public"."profiles"
for update
to authenticated
using ( auth.uid() = id );

-- Enable insert for users on their own profile
create policy "Users can insert their own profile"
on "public"."profiles"
for insert
to authenticated
with check ( auth.uid() = id );
