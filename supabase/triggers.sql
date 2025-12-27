-- Function to handle new user signup automatically
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, avatar_url, role, status)
  values (
    new.id,
    -- Extract metadata sent during SignUp
    coalesce(new.raw_user_meta_data ->> 'first_name', 'Unknown'),
    coalesce(new.raw_user_meta_data ->> 'last_name', 'Duelist'),
    null,
    'user',    -- Default role
    'pending'  -- Default status: Must be approved by Admin
  );
  return new;
end;
$$;

-- Trigger to execute the function after a new user is inserted into auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
