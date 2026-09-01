<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/community-lib.php';

date_default_timezone_set(APP_TIMEZONE);

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    session_name(SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => REMEMBER_COOKIE_DAYS * 86400,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function h(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function status_url(string $path = ''): string
{
    return rtrim(STATUS_SITE_URL, '/') . ($path === '' ? '/' : '/' . ltrim($path, '/'));
}

function render_head_meta(
    string $title,
    string $description,
    string $canonicalPath = '',
    bool $noIndex = false
): void {
    $canonical = status_url($canonicalPath);
    $preview = status_url('assets/images/social-preview.png');
    $robots = $noIndex ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large';

    echo '<title>' . h($title) . "</title>\n";
    echo '  <meta name="description" content="' . h($description) . '">' . "\n";
    echo '  <meta name="robots" content="' . h($robots) . '">' . "\n";
    echo '  <link rel="canonical" href="' . h($canonical) . '">' . "\n";
    echo '  <meta property="og:type" content="website">' . "\n";
    echo '  <meta property="og:site_name" content="The Secretary Status">' . "\n";
    echo '  <meta property="og:title" content="' . h($title) . '">' . "\n";
    echo '  <meta property="og:description" content="' . h($description) . '">' . "\n";
    echo '  <meta property="og:url" content="' . h($canonical) . '">' . "\n";
    echo '  <meta property="og:image" content="' . h($preview) . '">' . "\n";
    echo '  <meta property="og:image:secure_url" content="' . h($preview) . '">' . "\n";
    echo '  <meta property="og:image:type" content="image/png">' . "\n";
    echo '  <meta property="og:image:width" content="1901">' . "\n";
    echo '  <meta property="og:image:height" content="902">' . "\n";
    echo '  <meta property="og:image:alt" content="The Secretary live status dashboard">' . "\n";
    echo '  <meta name="twitter:card" content="summary_large_image">' . "\n";
    echo '  <meta name="twitter:title" content="' . h($title) . '">' . "\n";
    echo '  <meta name="twitter:description" content="' . h($description) . '">' . "\n";
    echo '  <meta name="twitter:image" content="' . h($preview) . '">' . "\n";
    echo '  <link rel="icon" type="image/png" href="/assets/images/favicon.png">' . "\n";
    echo '  <link rel="apple-touch-icon" href="/assets/images/favicon.png">' . "\n";
}

function is_configured(): bool
{
    return str_starts_with(GOOGLE_APPS_SCRIPT_URL, 'https://script.google.com/macros/s/')
        && !str_contains(GOOGLE_APPS_SCRIPT_URL, 'PASTE_')
        && strlen(GOOGLE_APPS_SCRIPT_SECRET) >= 32
        && !str_contains(GOOGLE_APPS_SCRIPT_SECRET, 'PASTE_');
}

function api_request(string $action, array $data = [], bool $authenticated = false): array
{
    $startedAt = microtime(true);
    $requestId = bin2hex(random_bytes(4));
    if (!is_configured()) {
        return [
            'ok' => false,
            'error' => 'Status service is not configured yet.',
            '_diagnostic' => ['requestId' => $requestId, 'stage' => 'configuration', 'transport' => 'none'],
        ];
    }

    $payload = array_merge(['action' => $action], $data);
    if ($authenticated) {
        $payload['secret'] = GOOGLE_APPS_SCRIPT_SECRET;
    }

    $isPost = $authenticated || $action !== 'status';
    $url = GOOGLE_APPS_SCRIPT_URL;
    if (!$isPost) {
        $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($payload);
    }

    $body = '';
    $httpCode = 0;
    $contentType = '';
    $transport = function_exists('curl_init') ? 'curl' : 'php-stream';

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => API_TIMEOUT_SECONDS,
            CURLOPT_USERAGENT => 'TheSecretaryStatus/1.0',
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        if ($isPost) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($payload));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Accept: application/json',
                'Content-Type: application/x-www-form-urlencoded',
            ]);
        }
        $result = curl_exec($ch);
        $body = is_string($result) ? $result : '';
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $curlError = curl_error($ch);
        curl_close($ch);
        if ($body === '') {
            $message = $curlError ?: 'The monitor service did not respond.';
            error_log('[The Secretary Status] Apps Script request failed for ' . $action . ': ' . $message);
            return [
                'ok' => false,
                'error' => $message,
                'httpCode' => $httpCode,
                '_diagnostic' => [
                    'requestId' => $requestId,
                    'stage' => 'transport',
                    'transport' => $transport,
                    'durationMs' => (int) round((microtime(true) - $startedAt) * 1000),
                    'responseBytes' => 0,
                ],
            ];
        }
    } else {
        $options = [
            'http' => [
                'method' => $isPost ? 'POST' : 'GET',
                'timeout' => API_TIMEOUT_SECONDS,
                'ignore_errors' => true,
                'header' => "Accept: application/json\r\nUser-Agent: TheSecretaryStatus/1.0\r\n",
            ],
        ];
        if ($isPost) {
            $options['http']['header'] .= "Content-Type: application/x-www-form-urlencoded\r\n";
            $options['http']['content'] = http_build_query($payload);
        }
        $result = @file_get_contents($url, false, stream_context_create($options));
        $body = is_string($result) ? $result : '';
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
            $httpCode = (int) $m[1];
        }
        foreach ($http_response_header ?? [] as $responseHeader) {
            if (stripos($responseHeader, 'Content-Type:') === 0) {
                $contentType = trim(substr($responseHeader, 13));
                break;
            }
        }
        if ($body === '') {
            $lastError = error_get_last();
            $message = is_array($lastError) && !empty($lastError['message'])
                ? (string) $lastError['message']
                : 'The monitor service did not respond.';
            error_log('[The Secretary Status] Apps Script stream request failed for ' . $action . ': ' . $message);
            return [
                'ok' => false,
                'error' => $message,
                'httpCode' => $httpCode,
                '_diagnostic' => [
                    'requestId' => $requestId,
                    'stage' => 'transport',
                    'transport' => $transport,
                    'durationMs' => (int) round((microtime(true) - $startedAt) * 1000),
                    'responseBytes' => 0,
                ],
            ];
        }
    }

    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        $jsonError = json_last_error_msg();
        error_log('[The Secretary Status] Apps Script returned invalid JSON for ' . $action . ' (HTTP ' . $httpCode . ', ' . $jsonError . ', ' . strlen($body) . ' bytes).');
        return [
            'ok' => false,
            'error' => 'The monitor returned invalid JSON: ' . $jsonError,
            'httpCode' => $httpCode,
            '_diagnostic' => [
                'requestId' => $requestId,
                'stage' => 'decode',
                'transport' => $transport,
                'durationMs' => (int) round((microtime(true) - $startedAt) * 1000),
                'contentType' => $contentType,
                'responseBytes' => strlen($body),
            ],
        ];
    }
    $decoded['_diagnostic'] = [
        'requestId' => $requestId,
        'stage' => empty($decoded['ok']) ? 'backend' : 'complete',
        'transport' => $transport,
        'httpCode' => $httpCode,
        'durationMs' => (int) round((microtime(true) - $startedAt) * 1000),
        'contentType' => $contentType,
        'responseBytes' => strlen($body),
    ];
    if (empty($decoded['ok'])) {
        error_log('[The Secretary Status] Backend rejected ' . $action . ': ' . (string) ($decoded['error'] ?? 'unknown error'));
    }
    return $decoded;
}

function require_admin(): void
{
    start_secure_session();
    if (empty($_SESSION['admin_authenticated'])) {
        header('Location: /admin/login');
        exit;
    }
    if (!empty($_SESSION['authenticated_at']) && (time() - (int) $_SESSION['authenticated_at']) > 43200) {
        $_SESSION = [];
        session_destroy();
        header('Location: /admin/login?expired=1');
        exit;
    }
}

function csrf_token(): string
{
    start_secure_session();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['csrf_token'];
}

function verify_csrf(): void
{
    start_secure_session();
    $sent = (string) ($_POST['csrf'] ?? '');
    if ($sent === '' || !hash_equals((string) ($_SESSION['csrf_token'] ?? ''), $sent)) {
        http_response_code(419);
        exit('Your session expired. Go back, refresh the page, and try again.');
    }
}

function redirect_admin(string $message, string $type = 'success'): never
{
    start_secure_session();
    $_SESSION['flash'] = ['message' => $message, 'type' => $type];
    $requested = (string) ($_POST['return_to'] ?? '/admin');
    $allowed = ['/admin', '/admin/incidents', '/admin/maintenance', '/admin/posts', '/admin/webhooks', '/admin/servers'];
    $destination = in_array($requested, $allowed, true) ? $requested : '/admin';
    header('Location: ' . $destination);
    exit;
}

function render_admin_header(string $active): void
{
    echo '<header class="site-header admin-header"><div class="container wide header-inner">';
    echo '<a class="brand" href="/admin"><span class="brand-mark"><img src="/assets/images/favicon.png" alt=""></span><span><strong>The Secretary</strong><small>Control room</small></span></a>';
    echo '<nav class="header-nav">';
    foreach (admin_destinations() as $key => $item) {
        echo '<a' . ($active === $key ? ' class="active-link"' : '') . ' href="' . h($item['href']) . '">' . h($item['label']) . '</a>';
    }
    echo '</nav><div class="header-actions"><a class="button small ghost" href="/" target="_blank" rel="noopener">Public page ↗</a><a class="button small" href="/admin/logout">Sign out</a></div></div></header>';
}

function render_admin_nav(string $active): void
{
    echo '<nav class="admin-tabs admin-route-tabs" aria-label="Administration">';
    foreach (admin_destinations() as $key => $item) {
        echo '<a' . ($active === $key ? ' class="active" aria-current="page"' : '') . ' href="' . h($item['href']) . '">' . h($item['label']) . '</a>';
    }
    echo '</nav>';
}

function admin_destinations(): array
{
    return [
        'overview' => ['label' => 'Overview', 'href' => '/admin'],
        'incidents' => ['label' => 'Incidents', 'href' => '/admin/incidents'],
        'maintenance' => ['label' => 'Maintenance', 'href' => '/admin/maintenance'],
        'posts' => ['label' => 'Posts', 'href' => '/admin/posts'],
        'webhooks' => ['label' => 'Webhooks', 'href' => '/admin/webhooks'],
        'servers' => ['label' => 'Servers', 'href' => '/admin/servers'],
    ];
}

function render_admin_flash(): void
{
    start_secure_session();
    $flash = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    if (!$flash) return;
    echo '<div class="flash ' . h(($flash['type'] ?? '') === 'error' ? 'error' : '') . '">' . h((string) ($flash['message'] ?? '')) . '</div>';
}

function format_time(?string $iso, string $format = 'j M Y, g:i A T'): string
{
    if (!$iso) {
        return 'Not checked yet';
    }
    try {
        $date = new DateTimeImmutable($iso);
        return $date->setTimezone(new DateTimeZone(APP_TIMEZONE))->format($format);
    } catch (Throwable) {
        return 'Unknown';
    }
}

function format_duration_ms($milliseconds): string
{
    if (!is_numeric($milliseconds)) {
        return '—';
    }
    return number_format((float) $milliseconds, 0) . ' ms';
}

function format_bytes_decimal($bytes): string
{
    if (!is_numeric($bytes)) return 'Unavailable';
    $value = max(0.0, (float) $bytes);
    if ($value >= 1000000000) return number_format($value / 1000000000, 2) . ' GB';
    if ($value >= 1000000) return number_format($value / 1000000, 1) . ' MB';
    return number_format($value / 1000, 1) . ' KB';
}

function status_label(string $status): string
{
    return match ($status) {
        'operational', 'up' => 'Operational',
        'degraded' => 'Degraded performance',
        'down', 'major_outage' => 'Major outage',
        'maintenance' => 'Under maintenance',
        default => 'Unknown',
    };
}

function status_class(string $status): string
{
    return match ($status) {
        'operational', 'up' => 'good',
        'degraded' => 'warn',
        'down', 'major_outage' => 'bad',
        'maintenance' => 'maint',
        default => 'unknown',
    };
}

function percent_or_dash($value): string
{
    return is_numeric($value) ? number_format((float) $value, 3) . '%' : 'No data';
}

function public_status_state(): array
{
    $data = api_request('status');
    $liveAvailable = !empty($data['ok']) && !empty($data['monitor']) && is_array($data['monitor']);
    $usingCached = false;
    $cachedAt = null;
    $backendError = $liveAvailable ? '' : (string) ($data['error'] ?? 'The monitor feed could not be reached.');
    $liveDiagnostic = is_array($data['_diagnostic'] ?? null) ? $data['_diagnostic'] : [];

    if ($liveAvailable) {
        write_public_status_cache($data);
    } else {
        $cached = read_public_status_cache();
        if ($cached !== null) {
            $data = $cached['data'];
            $usingCached = true;
            $cachedAt = $cached['cachedAt'];
        }
    }

    $available = ($liveAvailable || $usingCached) && !empty($data['monitor']) && is_array($data['monitor']);
    $monitor = $available ? $data['monitor'] : [];
    $summary = $available && is_array($data['summary'] ?? null) ? $data['summary'] : [];
    $incidents = $available && is_array($data['incidents'] ?? null) ? $data['incidents'] : [];
    $maintenance = $available && is_array($data['maintenance'] ?? null) ? $data['maintenance'] : [];
    $posts = $available && is_array($data['posts'] ?? null) ? $data['posts'] : [];
    $discordApi = $available && is_array($data['discordApi'] ?? null) ? $data['discordApi'] : [];
    $uptime = is_array($monitor['uptime'] ?? null) ? $monitor['uptime'] : [];
    $response = is_array($monitor['response'] ?? null) ? $monitor['response'] : [];
    $currentStatus = $available ? (string) ($summary['status'] ?? $monitor['status'] ?? 'unknown') : 'unknown';

    return [
        'data' => $data,
        'available' => $available,
        'usingCached' => $usingCached,
        'cachedAt' => $cachedAt,
        'backendError' => $backendError,
        'diagnostic' => $liveDiagnostic,
        'monitor' => $monitor,
        'summary' => $summary,
        'incidents' => $incidents,
        'maintenance' => $maintenance,
        'posts' => $posts,
        'discordApi' => $discordApi,
        'uptime' => $uptime,
        'response' => $response,
        'currentStatus' => $currentStatus,
        'statusClass' => status_class($currentStatus),
        'headline' => $available ? (string) ($summary['headline'] ?? status_label($currentStatus)) : 'Live status unavailable',
        'summaryText' => $available ? (string) ($summary['message'] ?? 'Live monitoring data is available.') : 'The monitor feed could not be reached. No operational claim is being made.',
        'unresolved' => array_values(array_filter($incidents, fn($item) => ($item['status'] ?? '') !== 'resolved')),
        'resolved' => array_values(array_filter($incidents, fn($item) => ($item['status'] ?? '') === 'resolved')),
        'activeMaintenance' => array_values(array_filter($maintenance, fn($item) => ($item['status'] ?? '') === 'active')),
        'history' => normalize_status_history(is_array($monitor['history'] ?? null) ? $monitor['history'] : []),
    ];
}

function status_cache_file(): string
{
    return __DIR__ . '/cache/status.json';
}

function write_public_status_cache(array $data): void
{
    $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($json)) {
        return;
    }
    $directory = dirname(status_cache_file());
    if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) {
        error_log('[The Secretary Status] Could not create the status cache directory.');
        return;
    }
    if (@file_put_contents(status_cache_file(), $json, LOCK_EX) === false) {
        error_log('[The Secretary Status] Could not write the last-known-good status cache.');
    }
}

function read_public_status_cache(int $maximumAgeSeconds = 21600): ?array
{
    $file = status_cache_file();
    if (!is_file($file)) {
        return null;
    }
    $modified = filemtime($file);
    if (!is_int($modified) || $modified < time() - $maximumAgeSeconds) {
        return null;
    }
    $decoded = json_decode((string) @file_get_contents($file), true);
    if (!is_array($decoded) || empty($decoded['ok']) || !is_array($decoded['monitor'] ?? null)) {
        return null;
    }
    return ['data' => $decoded, 'cachedAt' => date(DATE_ATOM, $modified)];
}

function public_archive(string $type): array
{
    if (!in_array($type, ['incidents', 'maintenance', 'posts'], true)) {
        return ['ok' => false, 'error' => 'Unknown archive.'];
    }
    $data = api_request('archive', ['type' => $type]);
    $cacheKey = 'archive-' . $type;
    if (!empty($data['ok'])) {
        write_public_content_cache($cacheKey, $data);
        return $data;
    }
    $cached = read_public_content_cache($cacheKey);
    return $cached ?? ['ok' => false, 'items' => [], 'error' => $data['error'] ?? 'Archive unavailable.'];
}

function public_content(string $type, string $slug): array
{
    if (!in_array($type, ['incident', 'maintenance', 'post'], true) || !preg_match('/^[a-z0-9][a-z0-9-]{0,119}$/', $slug)) {
        return ['ok' => false, 'error' => 'Page not found.'];
    }
    $cacheKey = 'content-' . $type . '-' . $slug;
    $data = api_request('content', ['type' => $type, 'slug' => $slug]);
    if (!empty($data['ok'])) {
        write_public_content_cache($cacheKey, $data);
        return $data;
    }
    return read_public_content_cache($cacheKey) ?? $data;
}

function write_public_content_cache(string $key, array $data): void
{
    if (!preg_match('/^[a-z0-9-]+$/', $key)) return;
    $directory = __DIR__ . '/cache/content';
    if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) return;
    $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (is_string($json)) @file_put_contents($directory . '/' . $key . '.json', $json, LOCK_EX);
}

function read_public_content_cache(string $key, int $maximumAgeSeconds = 2592000): ?array
{
    if (!preg_match('/^[a-z0-9-]+$/', $key)) return null;
    $file = __DIR__ . '/cache/content/' . $key . '.json';
    if (!is_file($file)) return null;
    $modified = filemtime($file);
    if (!is_int($modified) || $modified < time() - $maximumAgeSeconds) return null;
    $decoded = json_decode((string) @file_get_contents($file), true);
    if (!is_array($decoded) || empty($decoded['ok'])) return null;
    $decoded['_cached'] = true;
    return $decoded;
}

function render_site_header(string $active = ''): void
{
    $user = current_user();
    $flash = community_take_flash();
    $links = [
        'main' => ['Main Site', MAIN_SITE_URL],
        'posts' => ['Posts', '/posts'],
        'forums' => ['Forums', '/forums'],
        'incidents' => ['Incidents', '/incidents'],
    ];
    echo '<header class="site-header public-header"><div class="container header-inner">';
    echo '<a class="brand public-brand" href="/" aria-label="The Secretary status home"><span class="brand-mark"><img src="/assets/images/favicon.png" alt=""></span><strong>The <em>Secretary</em></strong></a>';
    echo '<nav class="header-nav public-nav" aria-label="Main navigation">';
    foreach ($links as $key => [$label, $href]) {
        echo '<a' . ($active === $key ? ' class="active-link" aria-current="page"' : '') . ' href="' . h($href) . '">' . h($label) . '</a>';
    }
    echo '</nav><div class="public-header-actions">';
    if ($user) {
        echo '<button class="header-account-button" type="button" data-account-menu-toggle aria-expanded="false" aria-label="Open account menu">' . community_render_avatar($user, 'header', false) . '</button>';
        echo '<div class="account-popover" data-account-menu hidden><div class="account-popover-user">' . community_render_avatar($user, 'medium', false) . '<span><strong>' . h((string) $user['display_name']) . '</strong><small>@' . h((string) $user['username']) . '</small></span></div><button type="button" data-profile-user="' . h((string) $user['username']) . '">View profile</button><button type="button" data-edit-profile>Edit profile</button><a class="danger" href="/logout">Log out</a></div>';
    } else {
        echo '<a class="button small account-login" href="/login">Log in</a>';
    }
    echo '<button class="mobile-nav-toggle" type="button" data-mobile-nav aria-expanded="false" aria-label="Toggle navigation"><span></span><span></span><span></span></button></div></div>';
    echo '<nav class="mobile-nav" data-mobile-menu hidden aria-label="Mobile navigation">';
    foreach ($links as $key => [$label, $href]) {
        echo '<a' . ($active === $key ? ' class="active-link"' : '') . ' href="' . h($href) . '">' . h($label) . '</a>';
    }
    echo '</nav></header>';
    if ($flash) {
        echo '<div class="community-toast ' . h((string) ($flash['type'] ?? 'success')) . '" data-community-toast>' . h((string) ($flash['message'] ?? 'Done.')) . '</div>';
    }
}

function render_subscribe_modal(): void
{
    echo '<dialog class="subscribe-dialog" data-subscribe-dialog><form method="post" action="/subscribe" class="subscribe-form"><button class="dialog-close" type="button" aria-label="Close" data-close-subscribe>×</button><span class="eyebrow">Status notifications</span><h2>Know before you wonder.</h2><p>Receive email alerts for outages, Discord API rate limits, maintenance, recoveries, and new system posts.</p><label>Email address<input type="email" name="email" autocomplete="email" placeholder="you@gmail.com" required maxlength="254"></label><label class="consent-row"><input type="checkbox" name="consent" value="1" required><span>I agree to receive operational emails from The Secretary.</span></label><button class="button primary full" type="submit">Subscribe</button><small>You can unsubscribe from any notification email.</small></form></dialog>';
}

function render_site_footer(): void
{
    echo '<footer class="site-footer"><div class="container footer-grid">';
    echo '<div class="footer-brand"><a class="brand" href="/"><span class="brand-mark"><img src="/assets/images/favicon.png" alt=""></span><strong>The <em>Secretary</em></strong></a><p>Your Personal Secretary</p><span class="footer-mobile-label">Menu</span><div class="footer-social"><a href="https://thesecretary.xyz/invite" aria-label="Discord" title="Discord"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 5.3A16.3 16.3 0 0 0 15.4 4l-.5 1a15 15 0 0 0-5.8 0l-.5-1a16.4 16.4 0 0 0-4.1 1.3C1.9 9.1 1.2 12.8 1.5 16.4a16.6 16.6 0 0 0 5 2.5l1.2-1.7a10.8 10.8 0 0 1-1.9-.9l.5-.4a11.7 11.7 0 0 0 11.4 0l.5.4a12 12 0 0 1-1.9.9l1.2 1.7a16.5 16.5 0 0 0 5-2.5c.4-4.2-.7-7.8-3-11.1ZM8.6 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.8 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/></svg></a><a href="https://gshergd.github.io/" aria-label="GitHub" title="GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.5v-2.2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1.1.1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.6.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.5.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.8 5.4-5.5 5.7.5.4.9 1.1.9 2.2v3.3c0 .3.2.6.8.5A11.5 11.5 0 0 0 12 .7Z"/></svg></a></div></div>';
    echo '<details class="footer-menu" open><summary>Product</summary><div><a href="https://discord.com/oauth2/authorize?client_id=1382221868869746739&amp;permissions=1394656931071&amp;integration_type=0&amp;scope=bot%20applications.commands">Invite</a><a href="https://thesecretary.xyz/">Home</a><a href="https://thesecretary.xyz/premium">Premium</a><a href="https://thesecretary.xyz/dashboard">Dashboard</a><a href="https://thesecretary.xyz/webhook">Webhooks</a><a href="https://thesecretary.xyz/staff">Staff Panel</a></div></details>';
    echo '<details class="footer-menu" open><summary>Company</summary><div><a href="https://gshergd.github.io/">About developer</a><a href="/posts">System posts</a></div></details>';
    echo '<details class="footer-menu" open><summary>Resources</summary><div><a href="https://thesecretary.xyz/documentation">Documentation</a><a href="https://thesecretary.xyz/invite">Support</a><a href="https://thesecretary.xyz/forum/fe157570-c8a1-41bf-8d37-95dbf64594ec">Report Downtime</a></div></details>';
    echo '<details class="footer-menu" open><summary>Policies</summary><div><a href="https://thesecretary.xyz/terms_of_service">Terms</a><a href="https://thesecretary.xyz/privacy_policy">Privacy</a><a href="/admin/login">Admin</a></div></details>';
    echo '</div><div class="footer-wordmark" aria-hidden="true">THE SECRETARY</div><div class="container footer-bottom"><span>© ' . date('Y') . ' The Secretary</span><span>English</span></div></footer>';
    render_community_overlays();
}

function render_community_overlays(): void
{
    $user = current_user();
    echo '<dialog class="profile-dialog" data-profile-dialog><div class="profile-dialog-shell"><button class="dialog-close profile-close" type="button" data-close-profile aria-label="Close profile">×</button><div data-profile-content><div class="profile-loading">Loading profile…</div></div></div></dialog>';
    if (!$user) {
        return;
    }
    $effect = in_array((string) $user['profile_effect'], ['aurora', 'nebula', 'ember', 'ocean', 'none'], true) ? (string) $user['profile_effect'] : 'aurora';
    echo '<dialog class="profile-edit-dialog" data-profile-edit-dialog><form method="post" action="/community-action" enctype="multipart/form-data" class="profile-editor" style="' . community_profile_style($user) . '"><input type="hidden" name="csrf" value="' . h(csrf_token()) . '"><input type="hidden" name="action" value="update_profile"><input type="hidden" name="return_to" value="' . h(safe_return_path((string) ($_SERVER['REQUEST_URI'] ?? '/'))) . '"><header><div><span class="eyebrow">Your profile</span><h2>Make it unmistakably yours.</h2></div><button class="dialog-close" type="button" data-close-profile-editor aria-label="Close profile editor">×</button></header><div class="profile-editor-grid">';
    echo '<section class="profile-live-preview effect-' . h($effect) . '" data-profile-preview><div class="profile-preview-banner" data-profile-banner' . (community_banner_url($user) ? ' style="background-image:url(\'' . h(community_banner_url($user)) . '\')"' : '') . '></div><div class="profile-preview-body">' . community_render_avatar($user, 'profile', false) . '<h3 data-profile-name>' . h((string) $user['display_name']) . '</h3><span>@' . h((string) $user['username']) . '</span><p data-profile-bio>' . h((string) ($user['bio'] ?: 'No bio yet.')) . '</p></div></section>';
    echo '<section class="profile-fields"><div class="split-fields"><label>Display name<input name="display_name" value="' . h((string) $user['display_name']) . '" required maxlength="80" data-profile-name-input></label><label>Username<input value="@' . h((string) $user['username']) . '" disabled></label></div><label>Bio<textarea name="bio" rows="4" maxlength="600" data-profile-bio-input>' . h((string) $user['bio']) . '</textarea></label><div class="split-fields"><label>Profile picture<input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-avatar-input><small>Square images work best · 5 MB max</small></label><label>Banner image<input name="banner" type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-banner-input><small>Wide images work best · 8 MB max</small></label></div><div class="split-fields"><label>Primary glow<input name="accent_primary" type="color" value="' . h((string) $user['accent_primary']) . '" data-primary-color></label><label>Secondary glow<input name="accent_secondary" type="color" value="' . h((string) $user['accent_secondary']) . '" data-secondary-color></label></div><label>Profile effect<select name="profile_effect" data-profile-effect>'; foreach (['aurora' => 'Aurora', 'nebula' => 'Nebula', 'ember' => 'Ember', 'ocean' => 'Ocean', 'none' => 'Minimal'] as $key => $label) { echo '<option value="' . h($key) . '"' . ($effect === $key ? ' selected' : '') . '>' . h($label) . '</option>'; } echo '</select></label><div class="profile-position-grid"><label>Avatar zoom<input name="avatar_scale" type="range" min="1" max="2" step="0.05" value="' . h((string) $user['avatar_scale']) . '"></label><label>Avatar horizontal<input name="avatar_x" type="range" min="0" max="100" value="' . h((string) $user['avatar_x']) . '"></label><label>Avatar vertical<input name="avatar_y" type="range" min="0" max="100" value="' . h((string) $user['avatar_y']) . '"></label><label>Banner vertical<input name="banner_y" type="range" min="0" max="100" value="' . h((string) $user['banner_y']) . '"></label></div><div class="form-actions"><button class="button ghost" type="button" data-close-profile-editor>Cancel</button><button class="button primary" type="submit">Save profile</button></div></section></div></form></dialog>';
}

function sanitize_rich_html(string $html): string
{
    $html = trim($html);
    if ($html === '') {
        return '';
    }
    if (!class_exists('DOMDocument')) {
        return '<p>' . nl2br(h(strip_tags($html))) . '</p>';
    }
    $allowed = ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'hr'];
    $dom = new DOMDocument('1.0', 'UTF-8');
    libxml_use_internal_errors(true);
    $dom->loadHTML('<?xml encoding="utf-8" ?><div id="rich-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    libxml_clear_errors();
    $root = $dom->getElementById('rich-root');
    if (!$root) {
        return '';
    }
    $nodes = [];
    foreach ((new DOMXPath($dom))->query('//*[@id="rich-root"]//*') ?: [] as $node) {
        if ($node instanceof DOMElement) {
            $nodes[] = $node;
        }
    }
    foreach (array_reverse($nodes) as $node) {
        $tag = strtolower($node->tagName);
        if (!in_array($tag, $allowed, true)) {
            if (in_array($tag, ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'], true)) {
                $node->parentNode?->removeChild($node);
            } else {
                $parent = $node->parentNode;
                if ($parent) {
                    while ($node->firstChild) {
                        $parent->insertBefore($node->firstChild, $node);
                    }
                    $parent->removeChild($node);
                }
            }
            continue;
        }
        foreach (iterator_to_array($node->attributes) as $attribute) {
            $name = strtolower($attribute->name);
            if ($tag !== 'a' || !in_array($name, ['href', 'target', 'rel'], true)) {
                $node->removeAttribute($attribute->name);
            }
        }
        if ($tag === 'a') {
            $href = trim($node->getAttribute('href'));
            if (!preg_match('#^(https?://|mailto:)#i', $href)) {
                $node->removeAttribute('href');
            }
            if ($node->getAttribute('target') !== '_blank') {
                $node->removeAttribute('target');
            }
            $node->setAttribute('rel', 'noopener noreferrer');
        }
    }
    $result = '';
    foreach ($root->childNodes as $child) {
        $result .= $dom->saveHTML($child);
    }
    return trim($result);
}

function render_rich_editor(string $fieldName, string $html = ''): void
{
    echo '<div class="editor-toolbar" role="toolbar" aria-label="Formatting">';
    foreach ([['bold', 'B'], ['italic', 'I'], ['underline', 'U'], ['formatBlock', 'H2', 'h2'], ['formatBlock', 'H3', 'h3'], ['insertUnorderedList', '• List'], ['insertOrderedList', '1. List'], ['formatBlock', 'Quote', 'blockquote'], ['removeFormat', 'Clear']] as $tool) {
        echo '<button type="button" data-editor-command="' . h($tool[0]) . '"' . (isset($tool[2]) ? ' data-editor-value="' . h($tool[2]) . '"' : '') . '>' . h($tool[1]) . '</button>';
    }
    echo '<button type="button" data-editor-link>Link</button></div>';
    echo '<div class="rich-editor" contenteditable="true" data-rich-editor data-placeholder="Write the full public page here…">' . sanitize_rich_html($html) . '</div>';
    echo '<textarea name="' . h($fieldName) . '" data-rich-output hidden>' . h($html) . '</textarea>';
}

function normalize_status_history(array $history): array
{
    $byDate = [];
    foreach ($history as $day) {
        if (!is_array($day)) {
            continue;
        }
        $date = substr((string) ($day['date'] ?? ''), 0, 10);
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $byDate[$date] = $day;
        }
    }

    $today = new DateTimeImmutable('today', new DateTimeZone(APP_TIMEZONE));
    $normalized = [];
    for ($daysAgo = 119; $daysAgo >= 0; $daysAgo--) {
        $date = $today->modify('-' . $daysAgo . ' days')->format('Y-m-d');
        $entry = $byDate[$date] ?? ['date' => $date, 'uptime' => null];
        $entry['date'] = $date;
        $normalized[] = $entry;
    }
    return $normalized;
}
