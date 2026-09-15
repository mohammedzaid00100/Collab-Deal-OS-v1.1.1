create or replace function public.update_profile_details(profile_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  role_value public.account_type;
  name_value text := trim(profile_data ->> 'name');
  description_value text := trim(profile_data ->> 'description');
  location_value text := trim(profile_data ->> 'location');
  category_value text := trim(profile_data ->> 'category');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(profile_data) is distinct from 'object' or pg_column_size(profile_data) > 10000 then raise exception 'Invalid profile'; end if;
  if name_value is null or char_length(name_value) not between 2 and 80
    or description_value is null or char_length(description_value) not between 20 and 500
    or location_value is null or char_length(location_value) not between 2 and 100
    or category_value is null or char_length(category_value) not between 2 and 80 then raise exception 'Invalid profile details'; end if;
  select account_type into role_value from public.users where id = auth.uid();
  if role_value = 'creator' then
    update public.creator_profiles set full_name = name_value, bio = description_value,
      location = location_value, niche = category_value where user_id = auth.uid() and onboarding_complete;
  elsif role_value = 'brand' then
    update public.brand_profiles set brand_name = name_value, description = description_value,
      location = location_value, industry = category_value where user_id = auth.uid() and onboarding_complete;
  else raise exception 'Profile unavailable'; end if;
  if not found then raise exception 'Completed profile required'; end if;
  insert into public.activity_log(actor_user_id,event_type,entity_type,entity_id)
  values(auth.uid(),'PROFILE_UPDATED','user',auth.uid());
end;
$$;
revoke all on function public.update_profile_details(jsonb) from public, anon;
grant execute on function public.update_profile_details(jsonb) to authenticated;
