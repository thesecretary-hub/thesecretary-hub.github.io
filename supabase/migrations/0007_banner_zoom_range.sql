-- Allow the banner editor to zoom out for wide images and farther in when needed.
alter table public.profiles
  drop constraint if exists profiles_banner_scale_check;

alter table public.profiles
  add constraint profiles_banner_scale_check
  check (banner_scale between 0.5 and 3);
