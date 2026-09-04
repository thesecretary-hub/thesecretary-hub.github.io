-- The Secretary Hub editorial posts.
-- Run once in Supabase SQL Editor after 0001 and 0002.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id),
  slug varchar(190) not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,189}$'),
  title varchar(180) not null check (char_length(title) between 1 and 180),
  excerpt varchar(500) not null default '',
  content_html text not null default '',
  full_thumb_url text not null,
  full_thumb_path text,
  poster_url text not null,
  poster_path text,
  gallery jsonb not null default '[]'::jsonb check (jsonb_typeof(gallery) = 'array'),
  status text not null default 'draft' check (status in ('draft','published')),
  is_pinned boolean not null default false,
  is_hero boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_public_idx on public.posts(status,published_at desc);
create index if not exists posts_pinned_idx on public.posts(is_pinned,published_at desc) where status='published';
create index if not exists posts_hero_idx on public.posts(is_hero,published_at desc) where status='published';

drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();

-- Selecting a seventh pinned post or fourth hero automatically removes the oldest selection.
create or replace function public.enforce_post_feature_limits() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.is_pinned then
    update public.posts set is_pinned=false
    where id in (select id from public.posts where is_pinned and id<>new.id order by updated_at desc offset 5);
  end if;
  if new.is_hero then
    update public.posts set is_hero=false
    where id in (select id from public.posts where is_hero and id<>new.id order by updated_at desc offset 2);
  end if;
  return new;
end $$;

drop trigger if exists posts_feature_limits on public.posts;
create trigger posts_feature_limits after insert or update of is_pinned,is_hero on public.posts
for each row when (new.is_pinned or new.is_hero) execute function public.enforce_post_feature_limits();

alter table public.posts enable row level security;
drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts for select using (status='published' or public.is_admin());
drop policy if exists posts_admin_insert on public.posts;
create policy posts_admin_insert on public.posts for insert to authenticated with check (public.is_admin() and author_id=auth.uid());
drop policy if exists posts_admin_update on public.posts;
create policy posts_admin_update on public.posts for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists posts_admin_delete on public.posts;
create policy posts_admin_delete on public.posts for delete to authenticated using (public.is_admin());

grant select on public.posts to anon,authenticated;
grant insert,update,delete on public.posts to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('post-media','post-media',true,20971520,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists post_media_public_read on storage.objects;
create policy post_media_public_read on storage.objects for select using (bucket_id='post-media');
drop policy if exists post_media_admin_insert on storage.objects;
create policy post_media_admin_insert on storage.objects for insert to authenticated with check (bucket_id='post-media' and public.is_admin());
drop policy if exists post_media_admin_update on storage.objects;
create policy post_media_admin_update on storage.objects for update to authenticated using (bucket_id='post-media' and public.is_admin()) with check (bucket_id='post-media' and public.is_admin());
drop policy if exists post_media_admin_delete on storage.objects;
create policy post_media_admin_delete on storage.objects for delete to authenticated using (bucket_id='post-media' and public.is_admin());
