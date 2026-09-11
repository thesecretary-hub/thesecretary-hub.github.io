begin;

alter table public.forum_topics drop constraint if exists forum_topics_category_check;
alter table public.forum_topics add constraint forum_topics_category_check
  check (category in ('suggestion','bugs','website-error','fatal-error','downtime','informal'));

create table if not exists public.forum_push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists forum_push_subscriptions_user_idx
  on public.forum_push_subscriptions(user_id);
alter table public.forum_push_subscriptions enable row level security;
revoke all on public.forum_push_subscriptions from anon;
grant select, insert, update, delete on public.forum_push_subscriptions to authenticated;
drop policy if exists forum_push_own_read on public.forum_push_subscriptions;
create policy forum_push_own_read on public.forum_push_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists forum_push_own_insert on public.forum_push_subscriptions;
create policy forum_push_own_insert on public.forum_push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists forum_push_own_update on public.forum_push_subscriptions;
create policy forum_push_own_update on public.forum_push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists forum_push_own_delete on public.forum_push_subscriptions;
create policy forum_push_own_delete on public.forum_push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.save_forum_push_subscription(push_endpoint text, push_p256dh text, push_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in to enable notifications.'; end if;
  insert into public.forum_push_subscriptions(user_id,endpoint,p256dh,auth)
  values(auth.uid(),push_endpoint,push_p256dh,push_auth)
  on conflict(endpoint) do update set user_id=auth.uid(),p256dh=excluded.p256dh,auth=excluded.auth,updated_at=now();
end $$;
revoke all on function public.save_forum_push_subscription(text,text,text) from public;
grant execute on function public.save_forum_push_subscription(text,text,text) to authenticated;

create table if not exists public.forum_reply_notification_deliveries (
  reply_id bigint not null references public.forum_replies(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(reply_id,recipient_id)
);
alter table public.forum_reply_notification_deliveries enable row level security;
revoke all on public.forum_reply_notification_deliveries from anon,authenticated;

commit;
