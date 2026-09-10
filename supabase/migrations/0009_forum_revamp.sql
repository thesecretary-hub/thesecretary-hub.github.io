-- Apply before deploying the updated forum frontend. Existing topics/replies are preserved.
begin;

-- Reading a topic must never move it to the top of the activity feed.
drop trigger if exists topics_touch on public.forum_topics;
create trigger topics_touch before update of title, body, status, solution_reply_id
on public.forum_topics for each row execute function public.touch_updated_at();

create or replace function public.forum_reply_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.forum_topics set updated_at = now() where id = new.topic_id;
  return new;
end $$;
create trigger forum_reply_activity after insert on public.forum_replies
for each row execute function public.forum_reply_activity();

create or replace function public.validate_forum_reply_reference() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    -- Serialize replies with closing a topic.
    perform 1 from public.forum_topics where id = new.topic_id and status <> 'closed' for update;
    if not found then raise exception 'This discussion is closed.'; end if;
  end if;
  if length(trim(new.body)) = 0 then raise exception 'Write a reply before posting.'; end if;
  if new.parent_id is not null and not exists (
    select 1 from public.forum_replies where id = new.parent_id
      and topic_id = new.topic_id and not is_deleted
  ) then raise exception 'Reply target is unavailable in this discussion.'; end if;
  return new;
end $$;

create or replace function public.validate_forum_topic_solution() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.solution_reply_id is not null and not exists (
    select 1 from public.forum_replies where id = new.solution_reply_id
      and topic_id = new.id and not is_deleted
  ) then raise exception 'Choose an available reply from this discussion.'; end if;
  return new;
end $$;

-- Keep historical reply votes, but replies no longer accept votes.
revoke insert, update, delete on public.forum_reply_votes from anon, authenticated;
revoke update(vote, updated_at) on public.forum_reply_votes from authenticated;
drop policy if exists reply_votes_owner_write on public.forum_reply_votes;

-- Aggregate in PostgreSQL, before pagination: never count a truncated REST response.
create or replace view public.forum_topic_summary with (security_invoker = true) as
select t.*, p.display_name, p.username, p.avatar_path,
  (select count(*) from public.forum_replies r where r.topic_id = t.id and not r.is_deleted) as reply_count,
  coalesce((select sum(v.vote) from public.forum_topic_votes v where v.topic_id = t.id), 0) as vote_score
from public.forum_topics t join public.profiles p on p.id = t.user_id;
grant select on public.forum_topic_summary to anon, authenticated;

create table public.forum_view_visits (
  topic_id bigint not null references public.forum_topics on delete cascade,
  visitor_id uuid not null,
  viewed_at timestamptz not null default now(),
  primary key(topic_id, visitor_id)
);
alter table public.forum_view_visits enable row level security;
revoke all on public.forum_view_visits from anon, authenticated;

-- One view per browser (or signed-in account) per topic per 24 hours.
-- Browser identifiers provide deduplication, not proof of a unique human.
create function public.record_forum_view(target_id bigint, visitor_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare accepted integer; total integer;
begin
  insert into public.forum_view_visits as visits(topic_id, visitor_id)
  values(target_id, coalesce(auth.uid(), visitor_id))
  on conflict on constraint forum_view_visits_pkey do update set viewed_at = now()
    where visits.viewed_at <= now() - interval '24 hours';
  get diagnostics accepted = row_count;
  if accepted > 0 then
    update public.forum_topics set views = views + 1 where id = target_id returning views into total;
  else
    select views into total from public.forum_topics where id = target_id;
  end if;
  return total;
end $$;
revoke all on function public.record_forum_view(bigint, uuid) from public;
grant execute on function public.record_forum_view(bigint, uuid) to anon, authenticated;
-- Retire the unbounded counter used by cached old clients.
revoke all on function public.increment_topic_views(bigint) from public, anon, authenticated;

create function public.set_forum_vote(target_id bigint, desired_vote integer) returns integer
language plpgsql security definer set search_path = public as $$
declare total integer;
begin
  if auth.uid() is null then raise exception 'Log in to vote.'; end if;
  if desired_vote is null or desired_vote not in (-1, 0, 1) then raise exception 'Invalid vote.'; end if;
  perform 1 from public.forum_topics where id = target_id for update;
  if not found then raise exception 'Discussion not found.'; end if;
  if desired_vote = 0 then
    delete from public.forum_topic_votes where topic_id = target_id and user_id = auth.uid();
  else
    insert into public.forum_topic_votes(topic_id, user_id, vote)
    values(target_id, auth.uid(), desired_vote)
    on conflict(topic_id, user_id) do update set vote = excluded.vote, updated_at = now();
  end if;
  select coalesce(sum(vote), 0) into total from public.forum_topic_votes where topic_id = target_id;
  return total;
end $$;
revoke all on function public.set_forum_vote(bigint, integer) from public;
grant execute on function public.set_forum_vote(bigint, integer) to authenticated;
commit;
