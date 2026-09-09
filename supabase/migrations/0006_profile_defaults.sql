-- Calm, neutral defaults for every new profile.
alter table public.profiles
  alter column accent_primary set default '#101013',
  alter column accent_secondary set default '#101013',
  alter column profile_effect set default 'none';

-- Only migrate profiles that still have the exact original appearance defaults.
update public.profiles
set accent_primary = '#101013',
    accent_secondary = '#101013',
    profile_effect = 'none',
    updated_at = now()
where avatar_path is null
  and banner_path is null
  and accent_primary = '#f2eb00'
  and accent_secondary = '#7c3aed'
  and profile_effect = 'aurora';
