# The Secretary Hub

The production Hub lives at <https://thesecretary-hub.github.io/>. The live status experience is preserved at <https://thesecretary-hub.github.io/status/>.

This repository uses three intentionally separate services:

- **GitHub Pages** serves the static website from `site/`.
- **Google Apps Script** runs monitoring, incident/maintenance storage, subscriptions, notifications, and Render host switching.
- **Supabase** provides community authentication, PostgreSQL posts/forums, post and profile media, and username login.

InfinityFree, PHP, MySQL, and `thesecretary-status.gt.tc` are no longer part of production and have been removed from this repository.

## Repository layout

```text
site/                       GitHub Pages production files
google-apps-script/         monitoring and host-management backend
supabase/migrations/        PostgreSQL schema and RLS policies
supabase/functions/         username-or-email login function
.github/workflows/pages.yml GitHub Pages deployment
```

## 1. Finish Supabase

1. Open the Supabase project.
2. Copy its **Project URL** from **Connect** or **Settings → API**.
3. Replace `PASTE_SUPABASE_PROJECT_URL` in `site/assets/config.js`.
4. Open **SQL Editor** and run `supabase/migrations/0001_community.sql`, `0002_fix_forum_validators.sql`, and `0003_posts.sql` in order. The last migration adds Hub posts and the `post-media` bucket.
5. In **Authentication → URL Configuration**, set:

```text
Site URL: https://thesecretary-hub.github.io
Redirect URL: https://thesecretary-hub.github.io/**
```

6. Deploy the username login function with the Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy login-identifier --no-verify-jwt
```

Users can still log in with email if this optional function is not yet deployed; username login specifically requires it.

The frontend contains only the Supabase publishable key. Never add a secret/service-role key, database password, or JWT signing secret to `site/` or Git.

### Deploy the separate account-verification Apps Script

The account code is intentionally separate from the status monitor.

1. In Supabase **Authentication → General Configuration**, disable **Allow new users to sign up**. This prevents anyone from bypassing the Hub verification flow through the public Supabase signup endpoint. The Apps Script uses the server-only Admin API to create verified users.
2. Create a new standalone Google Apps Script project.
3. Copy `google-apps-script/auth/Code.gs` and `google-apps-script/auth/appsscript.json` into it.
4. Add these Script Properties:

```text
SUPABASE_URL
SUPABASE_LEGACY_SERVICE_ROLE_KEY
OTP_PEPPER
```

`OTP_PEPPER` must be a private random string of at least 24 characters. The service-role key and pepper must never be added to frontend files or Git.

For `SUPABASE_LEGACY_SERVICE_ROLE_KEY`, use the legacy JWT-formatted `service_role` key (the long value beginning with `eyJ`), not a newer `sb_secret_` key. Supabase blocks `sb_secret_` keys when Google Apps Script's browser-like user agent calls the REST/Auth APIs. Keep this key only in Script Properties. The code still accepts the old `SUPABASE_SERVICE_ROLE_KEY` property name for compatibility.

For a free sender isolated from a personal identity, create a dedicated Gmail account named **The Secretary™**, use the project logo as that account's profile picture, and create/deploy this Apps Script while signed into that account. `MailApp` sends from the Google account that owns and executes the deployment; no SMTP credentials or custom-domain mailbox are required.

5. Run `setupAuthBackend()` once and approve its permissions. This installs the hourly cleanup that permanently removes Supabase users which remain unconfirmed for more than 24 hours.
6. Deploy it as a web app with **Execute as: Me** and **Who has access: Anyone**.
7. Copy its `/exec` URL into `site/assets/config.js` as `authScriptUrl`.

Registration now emails a six-digit code from the dedicated Gmail account under the sender name **The Secretary™** before creating the Supabase user. Password reset uses the same branded sender and an emailed code followed by a short-lived reset ticket. Passwords are never stored in Apps Script Properties.

## 2. Create the administrator account

1. Register normally at `/register/` using `dikshitaggarwal007@gmail.com`.
2. Confirm the email if email confirmation is enabled.
3. In Supabase **SQL Editor**, run:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where lower(email) = 'dikshitaggarwal007@gmail.com'
  limit 1
);
```

Public users cannot promote themselves because the frontend role has no permission to update the `role` column.

## 3. Update Google Apps Script

1. Replace the deployed Apps Script source with `google-apps-script/Code.gs` and update `appsscript.json`.
2. Add these Script Properties:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY

CLOUDFLARE_API_TOKEN
CLOUDFLARE_ZONE_ID

RENDER_VIRGINIA_SERVICE_ID
RENDER_VIRGINIA_API_KEY
RENDER_SINGAPORE_N2_SERVICE_ID
RENDER_SINGAPORE_N2_API_KEY
RENDER_SINGAPORE_N1_SERVICE_ID
RENDER_SINGAPORE_N1_API_KEY
RENDER_FRANKFURT_SERVICE_ID
RENDER_FRANKFURT_API_KEY
RENDER_OHIO_SERVICE_ID
RENDER_OHIO_API_KEY
```

`SUPABASE_PUBLISHABLE_KEY` is the browser-safe publishable key. `SUPABASE_URL` is the same Project URL used in `site/assets/config.js`.

3. Remove the retired `API_SECRET` Script Property after rotating it. It is no longer used by 4.0.
4. Run `setupStatusBackend()` only if this is a new Apps Script project. Existing installations keep their current spreadsheet and triggers.
5. Select **Deploy → Manage deployments**, edit the existing web app, select **New version**, then deploy.
6. Keep **Execute as: Me** and **Who has access: Anyone**. Public reads remain public; every private action verifies a live Supabase admin session.

## 4. Enable GitHub Pages

1. Push the changes to `main` when ready.
2. Open repository **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions**.
4. The included workflow uploads only `site/` and deploys it to:

```text
https://thesecretary-hub.github.io/
```

No Apache `.htaccess` configuration is required. GitHub Pages does not use it.

## Production routes

```text
/                       Hub landing page
/status/                Live system status
/posts/
/incidents/
/maintenance/
/content/?type=post&slug=...
/forums/
/topic/?slug=...
/login/
/register/
/profile/
/admin/
/admin/incidents/
/admin/maintenance/
/admin/posts/
/admin/webhooks/
/admin/servers/
```

## Security model

- Supabase Auth owns user passwords and sessions.
- PostgreSQL RLS protects every community table, including editorial posts.
- The database automatically caps hero posts at 3 and pinned posts at 6 by removing the oldest selection.
- Every post uses a 16:9 Full Thumb plus a square 1:1 Thumbnail (2160×2160 recommended).
- Storage policies restrict uploads to a folder named after the authenticated user ID.
- The publishable key may be present in browser source; RLS is the authorization boundary.
- Apps Script validates the Supabase access token, owner email, and `admin` profile role before any private action.
- Render and Cloudflare credentials remain only in Apps Script Properties.
- GitHub Actions publishes only `site/`.
- Secrets belong in Apps Script Properties or another server-side secret store, never in Git.
