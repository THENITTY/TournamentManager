-- Create a public bucket for avatars if it doesn't exist
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Set RLS Policies for the avatars bucket

-- 1. Allow public access to view avatars
create policy "Avatar images are publicly accessible."
on storage.objects for select
using ( bucket_id = 'avatars' );

-- 2. Allow authenticated users to upload an avatar
create policy "Anyone can upload an avatar."
on storage.objects for insert
with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

-- 3. Allow a user to update their own avatar
create policy "A user can update their own avatar."
on storage.objects for update
using ( bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1] );
