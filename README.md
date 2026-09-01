# The Secretary Status 3.1.0

This package contains the complete PHP status site plus a deployable Google Apps Script monitor backend.

## Accounts and community added in 3.1

- Public registration at `/register` and remembered login at `/login`.
- The owner OTP login remains isolated at `/admin/login`; public accounts cannot enter the control room.
- MySQL-backed accounts, hashed passwords, 30-day selector/validator remember tokens, login throttling, CSRF protection, and owner-only write controls.
- Discord-inspired profile cards with a full-size circular avatar, banner, bio, two accent colors, five visual effects, image positioning, avatar zoom, member details, and recent public activity.
- Profile cards open as overlays from the header, comments, topics, and replies. A signed-in member can edit their own profile or log out from the overlay.
- Post comments support create, edit, and delete for the comment owner.
- Forums at `/forums` with Suggestion, Bug & Glitches, Website Error, Fatal Error, and Downtime Discussion categories.
- Members can create topics, reply to topics or other replies, and upvote/downvote topics and replies. The original poster can close/reopen a topic and mark one reply as the accepted solution.
- Community pages use PHP/MySQL directly. They do not call Google Apps Script. Successful public post/archive responses are cached for up to 30 days so previously viewed posts and their SQL comments remain reachable during a monitor-backend interruption.

## One-time MySQL setup

1. In the InfinityFree control panel, create a MySQL database.
2. Open phpMyAdmin for that database and import `database.sql` from this package.
3. Copy the database host, database name, database username, and password into these `config.php` constants:

```text
DB_HOST
DB_NAME
DB_USER
DB_PASSWORD
```

Use the exact MySQL host shown by InfinityFree; it is commonly not `localhost`. Upload the `uploads/` directory and keep it writable by PHP. Its included `.htaccess` blocks scripts from being executed inside profile-upload folders.

Profile images are stored as randomized files under `uploads/avatars` and `uploads/banners`; their paths and all profile settings are stored in SQL. The database stores accounts, remember tokens, throttling data, comments, topics, replies, votes, and accepted-solution state.

## Host management added in 3.0

- A private two-attempt host-switch state machine runs across five Render accounts.
- HTTP downtime or a Discord rate-limit incident starts an automatic switch to the eligible server with the most remaining bandwidth.
- The previous active server receives a 48-hour offline hold and cannot be selected during that period.
- The target service is resumed, the latest connected-branch commit is deployed, both Render custom domains are moved, both Cloudflare CNAME records are updated, and every non-active service is suspended.
- The controller waits 20 minutes after cutover and validates both the public HTTP endpoint and Discord health. A failed validation receives one final server attempt; a second failure stops automation and emails the administrator.
- Host-switch details, server names, usage, audit records, and errors are returned only by the authenticated admin payload. The public status payload and UI are unchanged.
- The admin area is split into `/admin`, `/admin/incidents`, `/admin/maintenance`, `/admin/posts`, `/admin/webhooks`, and `/admin/servers`.
- Manual switching requires a reason and is limited to once every 20 minutes. Any server can be manually excluded for 24 or 48 hours.
- Bandwidth is read from Render's public metrics API. Pipeline remaining is explicitly labelled as an estimate derived from the current month's deploy durations because Render does not expose exact remaining pipeline minutes in its public API.

## Required private Script Properties

Keep every token out of `Code.gs`, PHP, HTML, and Git. In **Apps Script → Project settings → Script properties**, add:

```text
API_SECRET
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

`API_SECRET` must remain identical to `GOOGLE_APPS_SCRIPT_SECRET` in `config.php`. `setupStatusBackend()` creates `STATUS_SPREADSHEET_ID` automatically if it does not exist.

The defaults assume each Render workspace has 5 GB bandwidth and 500 pipeline minutes. Override any account independently when needed:

```text
HOST_VIRGINIA_BANDWIDTH_GB
HOST_VIRGINIA_PIPELINE_MINUTES
HOST_SINGAPORE_N2_BANDWIDTH_GB
HOST_SINGAPORE_N2_PIPELINE_MINUTES
HOST_SINGAPORE_N1_BANDWIDTH_GB
HOST_SINGAPORE_N1_PIPELINE_MINUTES
HOST_FRANKFURT_BANDWIDTH_GB
HOST_FRANKFURT_PIPELINE_MINUTES
HOST_OHIO_BANDWIDTH_GB
HOST_OHIO_PIPELINE_MINUTES
```

Do not manually add `HOST_ACTIVE_KEY`. On its first server refresh, the controller compares the Cloudflare CNAME target with each Render service URL and stores the matching active server.

## What changed

- Live-feed failures now appear immediately in the browser console with the request stage, transport, HTTP status, response type/size, duration, and a copyable diagnostic object. The public polling endpoint returns HTTP 503 while no live or cached monitor snapshot is available and retries after 15 seconds.
- Black/yellow Secretary visual system with a translucent centered header and full Secretary footer.
- Five-minute autonomous HTTP checks remain independent of page visits.
- The five-minute monitor also reads `https://thesecretary.xyz/api/status/discord-rate-limit`. The bot performs the authenticated Discord probe only every 30 minutes, so this does not add excessive Discord API traffic.
- Discord HTTP 429 is treated as a critical incident, with automatic creation and automatic recovery.
- Active maintenance is shown as a compact advisory instead of a critical outage hero.
- Latest limits on the homepage: 5 incidents, 5 maintenance windows, and 6 posts.
- Public archives: `/incidents`, `/maintenance`, and `/posts`.
- Public detail pages: `/incidents/<slug>`, `/maintenance/<slug>`, and `/posts/<slug>`.
- Admin rich-text editor, custom titles, editable slugs, public summaries, timelines, and post publishing.
- Email subscriptions for outage, rate-limit, recovery, maintenance, and new-post alerts.
- Four independently configurable Discord webhook destinations with seven editable event templates.
- Strict Discord and email delivery reporting for new posts. A post is not stored publicly when a configured delivery fails.
- Per-post controls to resend Discord announcements, resend subscriber email, or permanently delete the post.
- One-click tests for each saved Discord webhook destination.
- Public status reads are side-effect free; Discord/Gmail failures can no longer make `doGet` hang or return an unavailable feed.
- Automated notification failures are recorded and shown in the admin panel without stopping five-minute checks.
- A six-hour last-known-good public snapshot is used during short Apps Script/hosting interruptions and is clearly labelled as cached.
- Single-line Secretary header branding, responsive dashboard/menu controls, corrected infrastructure pins, interactive response-chart tooltips, full-viewport footer, mobile footer accordions, and viewport-height admin editors.

## Deploy the backend

1. Create or open a Google Apps Script project.
2. Replace its `Code.gs` with `google-apps-script/Code.gs` and its manifest with `google-apps-script/appsscript.json`.
3. In **Project Settings → Script properties**, add `API_SECRET`. Its value must exactly match `GOOGLE_APPS_SCRIPT_SECRET` in `config.php`.
4. Run `setupStatusBackend()` once and approve the requested Sheets, external-request, trigger, and email permissions.
5. Deploy as a Web app:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Paste the deployed `/exec` URL into `GOOGLE_APPS_SCRIPT_URL` in `config.php`.

`setupStatusBackend()` creates the data spreadsheet and the five-minute time trigger. It is safe to run again; the old monitor trigger is replaced rather than duplicated.

## Updating an existing installation

1. Keep the existing Apps Script project. Do not create a new project or spreadsheet.
2. Replace its `Code.gs` with `google-apps-script/Code.gs` from this package and update the manifest from `google-apps-script/appsscript.json`.
3. Select **Deploy → Manage deployments**, edit the current web app, choose **New version**, and deploy.
4. Upload the PHP website files. The existing `/exec` URL and `config.php` values remain unchanged.

Existing posts, incidents, maintenance windows, subscribers, checks, settings, and webhook templates remain in the spreadsheet identified by the existing `STATUS_SPREADSHEET_ID`. Updating and redeploying the code does not clear those rows. Running `setupStatusBackend()` is not required for this update.

### Required one-time cleanup

The old `checkService` trigger is not used by this backend and will fail because that legacy handler no longer exists. After deploying this update:

1. Select `cleanupLegacyStatusTriggers` in the Apps Script function menu.
2. Run it once from the Google account that created the old trigger.
3. Confirm that only `runScheduledChecks` remains on the Apps Script **Triggers** page.

This cleanup deletes only the obsolete trigger. It does not touch the status spreadsheet or any public record.

The PHP package includes `cache/.htaccess`. Upload that directory as well. PHP writes the last successful public status JSON plus last-known-good archive/content responses into this private directory; it is denied to web visitors.

New-post publishing now performs configured Discord delivery and subscriber/admin email delivery before writing the post record. If either delivery reports an error, the admin page displays it and the post is not published. Because Discord, Gmail, and Google Sheets are separate services, a provider failure after another provider already accepted its message can still cause a partial external delivery; use the resend controls only after checking what arrived.

If the current Apps Script project uses a different storage layout, export its existing incident and maintenance history before replacing the backend. This ZIP could not include an automatic migration because the original Apps Script source was not present in `download.zip`.

## Deploy the PHP site

Upload the contents of this directory, excluding `google-apps-script/`, to the document root of `thesecretary-status.gt.tc`. Include `database.sql` only long enough to import it, then it may be removed from the server. Apache rewrite support is required for clean archive, forum, account, and slug routes.

Before deployment, rotate the API secret if this archive has ever been shared. Keep the PHP secret and Apps Script `API_SECRET` identical.

## Notification placeholders

Webhook templates support:

- `{timestamp}` — Discord Unix timestamp
- `{page_url}` — full incident, maintenance, or post URL
- `{slug}` — page slug
- `{title}` — public title

The subscriber list is stored in the backend spreadsheet. Every email includes an unsubscribe link.

## Existing bot integration

No additional Discord request code is necessary. The bot repository already exposes:

- `/api/status/discord`
- `/api/status/discord-rate-limit`

The status backend reads this public, no-cache endpoint during each monitoring cycle.
