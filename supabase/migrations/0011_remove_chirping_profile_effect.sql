begin;
update public.profiles set profile_effect = 'none' where profile_effect = 'chirping';
alter table public.profiles drop constraint if exists profiles_profile_effect_check;
alter table public.profiles add constraint profiles_profile_effect_check check (profile_effect in ('none', 'aurora', 'nebula', 'ember', 'ocean'));
commit;
