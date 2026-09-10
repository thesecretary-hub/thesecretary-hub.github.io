-- Allow the beta effect to be saved using the existing profile update policy.
begin;
alter table public.profiles drop constraint if exists profiles_profile_effect_check;
alter table public.profiles add constraint profiles_profile_effect_check
  check (profile_effect in ('aurora','nebula','ember','ocean','none','chirping'));
commit;
