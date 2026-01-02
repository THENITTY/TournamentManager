-- Allow users to update their own posts
create policy "Users can update own posts" on league_posts
    for update using (
        auth.uid() = user_id
    );

-- Allow users to delete their own posts
create policy "Users can delete own posts" on league_posts
    for delete using (
        auth.uid() = user_id
    );
