-- Create post_views table to track which users have seen which posts
CREATE TABLE public.post_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.league_posts(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, post_id) -- Ensure a user only has one view record per post
);

-- Enable RLS
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

-- Policies
-- Users can insert their own view records
CREATE POLICY "Users can insert their own post views" 
ON public.post_views 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can view their own view records (to check what they've seen)
CREATE POLICY "Users can view their own post views" 
ON public.post_views 
FOR SELECT 
USING (auth.uid() = user_id);
