<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /admin');
    exit;
}
verify_csrf();

$action = (string) ($_POST['action'] ?? '');
$payload = [];
$successMessage = 'Saved.';

switch ($action) {
    case 'check_now':
        $successMessage = 'The live check completed and the status was refreshed.';
        break;

    case 'update_settings':
        $url = trim((string) ($_POST['target_url'] ?? ''));
        $discordStatusUrl = trim((string) ($_POST['discord_status_url'] ?? ''));
        if (!filter_var($url, FILTER_VALIDATE_URL) || !str_starts_with(strtolower($url), 'https://')) {
            redirect_admin('The monitor URL must be a valid HTTPS address.', 'error');
        }
        if (!filter_var($discordStatusUrl, FILTER_VALIDATE_URL) || !str_starts_with(strtolower($discordStatusUrl), 'https://')) {
            redirect_admin('The Discord status URL must be a valid HTTPS address.', 'error');
        }
        $payload = [
            'monitor_name' => mb_substr(trim((string) ($_POST['monitor_name'] ?? 'The Secretary')), 0, 80),
            'description' => mb_substr(trim((string) ($_POST['description'] ?? '')), 0, 240),
            'target_url' => $url,
            'failure_threshold' => (string) max(1, min(3, (int) ($_POST['failure_threshold'] ?? 1))),
            'discord_status_url' => $discordStatusUrl,
        ];
        $successMessage = 'Monitor settings updated. Future checks will use the new target.';
        break;

    case 'create_incident':
        $title = trim((string) ($_POST['title'] ?? ''));
        $message = trim((string) ($_POST['message'] ?? ''));
        $impact = (string) ($_POST['impact'] ?? 'minor');
        if ($title === '' || $message === '' || !in_array($impact, ['minor', 'major', 'critical'], true)) {
            redirect_admin('Add a title, a detailed update, and a valid impact level.', 'error');
        }
        $payload = [
            'title' => mb_substr($title, 0, 120),
            'slug' => mb_substr(trim((string) ($_POST['slug'] ?? '')), 0, 120),
            'message' => mb_substr($message, 0, 3000),
            'excerpt' => mb_substr(trim((string) ($_POST['excerpt'] ?? '')), 0, 300),
            'content_html' => mb_substr(sanitize_rich_html((string) ($_POST['content_html'] ?? '')), 0, 50000),
            'impact' => $impact,
        ];
        $successMessage = 'Incident published to the public status page.';
        break;

    case 'add_incident_update':
        $id = trim((string) ($_POST['id'] ?? ''));
        $message = trim((string) ($_POST['message'] ?? ''));
        $status = (string) ($_POST['status'] ?? 'monitoring');
        if ($id === '' || $message === '' || !in_array($status, ['investigating', 'identified', 'monitoring', 'resolved'], true)) {
            redirect_admin('Choose an incident, status, and detailed message.', 'error');
        }
        $payload = ['id' => $id, 'message' => mb_substr($message, 0, 3000), 'status' => $status];
        $successMessage = $status === 'resolved' ? 'Incident resolved and recovery published.' : 'Incident update published.';
        break;

    case 'create_maintenance':
        $title = trim((string) ($_POST['title'] ?? ''));
        $description = trim((string) ($_POST['description'] ?? ''));
        $start = trim((string) ($_POST['start_at'] ?? ''));
        $end = trim((string) ($_POST['end_at'] ?? ''));
        if ($title === '' || $description === '' || !$start || !$end || strtotime($end) <= strtotime($start)) {
            redirect_admin('Add a title and description, and make sure the end time is after the start.', 'error');
        }
        $payload = [
            'title' => mb_substr($title, 0, 120),
            'slug' => mb_substr(trim((string) ($_POST['slug'] ?? '')), 0, 120),
            'description' => mb_substr($description, 0, 3000),
            'content_html' => mb_substr(sanitize_rich_html((string) ($_POST['content_html'] ?? '')), 0, 50000),
            'start_at' => (new DateTimeImmutable($start, new DateTimeZone(APP_TIMEZONE)))->format(DateTimeInterface::ATOM),
            'end_at' => (new DateTimeImmutable($end, new DateTimeZone(APP_TIMEZONE)))->format(DateTimeInterface::ATOM),
        ];
        $successMessage = 'Maintenance window scheduled and published.';
        break;

    case 'edit_maintenance':
        $id = trim((string) ($_POST['id'] ?? ''));
        $title = trim((string) ($_POST['title'] ?? ''));
        $description = trim((string) ($_POST['description'] ?? ''));
        $start = trim((string) ($_POST['start_at'] ?? ''));
        $end = trim((string) ($_POST['end_at'] ?? ''));
        if ($id === '' || $title === '' || $description === '' || !$start || !$end || strtotime($end) <= strtotime($start)) {
            redirect_admin('Add a title and description, and make sure the end time is after the start.', 'error');
        }
        $payload = [
            'id' => $id,
            'title' => mb_substr($title, 0, 120),
            'slug' => mb_substr(trim((string) ($_POST['slug'] ?? '')), 0, 120),
            'description' => mb_substr($description, 0, 3000),
            'content_html' => mb_substr(sanitize_rich_html((string) ($_POST['content_html'] ?? '')), 0, 50000),
            'start_at' => (new DateTimeImmutable($start, new DateTimeZone(APP_TIMEZONE)))->format(DateTimeInterface::ATOM),
            'end_at' => (new DateTimeImmutable($end, new DateTimeZone(APP_TIMEZONE)))->format(DateTimeInterface::ATOM),
        ];
        $successMessage = 'Maintenance page and schedule updated.';
        break;

    case 'create_post':
        $title = trim((string) ($_POST['title'] ?? ''));
        $excerpt = trim((string) ($_POST['excerpt'] ?? ''));
        if ($title === '' || $excerpt === '') {
            redirect_admin('Add a post title and card excerpt.', 'error');
        }
        $payload = [
            'title' => mb_substr($title, 0, 120),
            'slug' => mb_substr(trim((string) ($_POST['slug'] ?? '')), 0, 120),
            'excerpt' => mb_substr($excerpt, 0, 300),
            'content_html' => mb_substr(sanitize_rich_html((string) ($_POST['content_html'] ?? '')), 0, 50000),
        ];
        $successMessage = 'System post published.';
        break;

    case 'resend_post_discord':
        $payload = ['id' => trim((string) ($_POST['id'] ?? ''))];
        if ($payload['id'] === '') {
            redirect_admin('Post ID is missing.', 'error');
        }
        $successMessage = 'The Discord announcement was resent successfully.';
        break;

    case 'resend_post_email':
        $payload = ['id' => trim((string) ($_POST['id'] ?? ''))];
        if ($payload['id'] === '') {
            redirect_admin('Post ID is missing.', 'error');
        }
        $successMessage = 'The post email was resent to active subscribers and the administrator.';
        break;

    case 'delete_post':
        $payload = ['id' => trim((string) ($_POST['id'] ?? ''))];
        if ($payload['id'] === '') {
            redirect_admin('Post ID is missing.', 'error');
        }
        $successMessage = 'The post was permanently deleted.';
        break;

    case 'test_webhook':
        $kind = trim((string) ($_POST['kind'] ?? ''));
        if (!in_array($kind, ['http', 'discord', 'post', 'maintenance'], true)) {
            redirect_admin('Choose a valid webhook destination.', 'error');
        }
        $payload = ['kind' => $kind];
        $successMessage = ucfirst($kind) . ' webhook test delivered successfully.';
        break;

    case 'edit_content':
        $type = trim((string) ($_POST['type'] ?? ''));
        $id = trim((string) ($_POST['id'] ?? ''));
        $title = trim((string) ($_POST['title'] ?? ''));
        if (!in_array($type, ['incident', 'maintenance', 'post'], true) || $id === '' || $title === '') {
            redirect_admin('The page type, record, and title are required.', 'error');
        }
        $payload = [
            'type' => $type,
            'id' => $id,
            'title' => mb_substr($title, 0, 120),
            'slug' => mb_substr(trim((string) ($_POST['slug'] ?? '')), 0, 120),
            'excerpt' => mb_substr(trim((string) ($_POST['excerpt'] ?? '')), 0, 300),
            'content_html' => mb_substr(sanitize_rich_html((string) ($_POST['content_html'] ?? '')), 0, 50000),
        ];
        $successMessage = 'Public page updated.';
        break;

    case 'update_webhooks':
        $payload = [];
        foreach (['http', 'discord', 'post', 'maintenance'] as $key) {
            $url = trim((string) ($_POST['webhook_' . $key] ?? ''));
            if ($url !== '' && (!filter_var($url, FILTER_VALIDATE_URL) || !preg_match('#^https://(?:canary\.|ptb\.)?discord(?:app)?\.com/api/webhooks/#i', $url))) {
                redirect_admin('Every webhook must be a valid Discord webhook URL.', 'error');
            }
            $payload['webhook_' . $key] = $url;
        }
        foreach (['http_down', 'http_up', 'discord_limited', 'discord_normal', 'post', 'maintenance_start', 'maintenance_end'] as $key) {
            $payload['template_' . $key] = mb_substr(trim((string) ($_POST['template_' . $key] ?? '')), 0, 4000);
        }
        $successMessage = 'Webhook destinations and templates updated.';
        break;

    case 'cancel_maintenance':
        $payload = ['id' => trim((string) ($_POST['id'] ?? ''))];
        if ($payload['id'] === '') {
            redirect_admin('Maintenance ID is missing.', 'error');
        }
        $successMessage = 'Maintenance window cancelled.';
        break;

    case 'delete_maintenance':
        $payload = ['id' => trim((string) ($_POST['id'] ?? ''))];
        if ($payload['id'] === '') {
            redirect_admin('Maintenance ID is missing.', 'error');
        }
        $successMessage = 'The maintenance page was permanently deleted.';
        break;

    case 'refresh_servers':
        $successMessage = 'Render usage and service states were refreshed.';
        break;

    case 'switch_server':
        $serverKey = trim((string) ($_POST['server_key'] ?? ''));
        $reason = trim((string) ($_POST['reason'] ?? ''));
        if ($serverKey === '' || mb_strlen($reason) < 4) {
            redirect_admin('Choose a target server and provide a meaningful reason.', 'error');
        }
        $payload = ['server_key' => $serverKey, 'reason' => mb_substr($reason, 0, 500)];
        $successMessage = 'Host switch started. Deployment and validation will continue in the background.';
        break;

    case 'set_server_offline':
        $serverKey = trim((string) ($_POST['server_key'] ?? ''));
        $reason = trim((string) ($_POST['reason'] ?? ''));
        $hours = (int) ($_POST['hours'] ?? 0);
        if ($serverKey === '' || !in_array($hours, [24, 48], true) || mb_strlen($reason) < 4) {
            redirect_admin('Choose a server, a 24/48-hour hold, and provide a reason.', 'error');
        }
        $payload = ['server_key' => $serverKey, 'hours' => (string) $hours, 'reason' => mb_substr($reason, 0, 500)];
        $successMessage = 'The server was excluded from automatic host selection.';
        break;

    case 'clear_server_offline':
        $payload = ['server_key' => trim((string) ($_POST['server_key'] ?? ''))];
        if ($payload['server_key'] === '') {
            redirect_admin('Server key is missing.', 'error');
        }
        $successMessage = 'The server is eligible for automatic selection again.';
        break;

    default:
        redirect_admin('Unknown dashboard action.', 'error');
}

$response = api_request($action, $payload, true);
if (empty($response['ok'])) {
    redirect_admin((string) ($response['error'] ?? 'The status service rejected the request.'), 'error');
}
redirect_admin($successMessage);
