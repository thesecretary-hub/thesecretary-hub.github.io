-- Delivery receipts for posts published through the Supabase Post Studio.

alter table public.posts
  add column if not exists discord_notified_at timestamptz,
  add column if not exists email_notified_at timestamptz;
