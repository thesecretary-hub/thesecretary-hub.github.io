-- Persist the same banner crop in compact cards, full profiles, and the editor.

alter table public.profiles
  add column if not exists banner_scale numeric(3,2) not null default 1 check (banner_scale between 1 and 2),
  add column if not exists banner_x smallint not null default 50 check (banner_x between 0 and 100);

grant update(banner_scale,banner_x) on public.profiles to authenticated;
