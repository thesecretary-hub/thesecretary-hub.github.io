-- Run once in Supabase SQL Editor on installations that already ran 0001.
create or replace function public.validate_forum_reply_reference() returns trigger
language plpgsql as $$
begin
  if new.parent_id is not null and
     not exists(select 1 from public.forum_replies p where p.id=new.parent_id and p.topic_id=new.topic_id) then
    raise exception 'Parent reply must belong to the same topic.';
  end if;
  return new;
end $$;

create or replace function public.validate_forum_topic_solution() returns trigger
language plpgsql as $$
begin
  if new.solution_reply_id is not null and
     not exists(select 1 from public.forum_replies r where r.id=new.solution_reply_id and r.topic_id=new.id) then
    raise exception 'Solution reply must belong to this topic.';
  end if;
  return new;
end $$;

drop trigger if exists replies_validate_reference on public.forum_replies;
create trigger replies_validate_reference before insert or update on public.forum_replies
for each row execute function public.validate_forum_reply_reference();

drop trigger if exists topics_validate_reference on public.forum_topics;
create trigger topics_validate_reference before insert or update on public.forum_topics
for each row execute function public.validate_forum_topic_solution();

drop function if exists public.validate_forum_reference();
