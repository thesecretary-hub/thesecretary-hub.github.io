<?php
declare(strict_types=1);

const COMMUNITY_CATEGORIES = [
    'suggestion' => ['Suggestion', 'Ideas that could make The Secretary better.', '#a78bfa'],
    'bugs' => ['Bug & Glitches', 'Unexpected behaviour and reproducible bugs.', '#fb7185'],
    'website-error' => ['Website Error', 'Problems affecting a Secretary website.', '#38bdf8'],
    'fatal-error' => ['Fatal Error', 'Critical failures that prevent normal use.', '#ef4444'],
    'downtime' => ['Downtime Discussion', 'Outage context, reports, and recovery discussion.', '#f2eb00'],
];

function community_db_configured(): bool
{
    return DB_HOST !== '' && DB_NAME !== '' && DB_USER !== ''
        && !str_contains(DB_HOST, 'PASTE_')
        && !str_contains(DB_NAME, 'PASTE_')
        && !str_contains(DB_USER, 'PASTE_');
}

function community_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    if (!community_db_configured()) {
        throw new RuntimeException('The community database has not been configured.');
    }
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASSWORD, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function community_try_db(): ?PDO
{
    try {
        return community_db();
    } catch (Throwable $error) {
        error_log('[The Secretary Community] Database unavailable: ' . $error->getMessage());
        return null;
    }
}

function community_cookie_options(int $expires): array
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    return ['expires' => $expires, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax'];
}

function community_user_by_id(int $id): ?array
{
    if ($id < 1 || !($db = community_try_db())) {
        return null;
    }
    $stmt = $db->prepare('SELECT id, display_name, username, email, role, bio, avatar_path, banner_path, accent_primary, accent_secondary, profile_effect, avatar_scale, avatar_x, avatar_y, banner_y, created_at, updated_at FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    return is_array($user) ? $user : null;
}

function community_user_by_username(string $username): ?array
{
    if (!($db = community_try_db())) {
        return null;
    }
    $stmt = $db->prepare('SELECT id, display_name, username, email, role, bio, avatar_path, banner_path, accent_primary, accent_secondary, profile_effect, avatar_scale, avatar_x, avatar_y, banner_y, created_at, updated_at FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([strtolower(trim($username))]);
    $user = $stmt->fetch();
    return is_array($user) ? $user : null;
}

function community_reset_current_user(): void
{
    unset($GLOBALS['community_current_user_resolved'], $GLOBALS['community_current_user']);
}

function current_user(): ?array
{
    if (!empty($GLOBALS['community_current_user_resolved'])) {
        return is_array($GLOBALS['community_current_user'] ?? null) ? $GLOBALS['community_current_user'] : null;
    }
    start_secure_session();
    $GLOBALS['community_current_user_resolved'] = true;
    $GLOBALS['community_current_user'] = null;
    if (!empty($_SESSION['user_id'])) {
        $user = community_user_by_id((int) $_SESSION['user_id']);
        if ($user) {
            $GLOBALS['community_current_user'] = $user;
            return $user;
        }
        unset($_SESSION['user_id']);
    }
    $cookie = (string) ($_COOKIE[REMEMBER_COOKIE_NAME] ?? '');
    if ($cookie === '' || !str_contains($cookie, ':') || !($db = community_try_db())) {
        return null;
    }
    [$selector, $validator] = array_pad(explode(':', $cookie, 2), 2, '');
    if (!preg_match('/^[a-f0-9]{24}$/', $selector) || !preg_match('/^[a-f0-9]{64}$/', $validator)) {
        community_forget_cookie();
        return null;
    }
    $stmt = $db->prepare('SELECT user_id, token_hash FROM remember_tokens WHERE selector = ? AND expires_at > UTC_TIMESTAMP() LIMIT 1');
    $stmt->execute([$selector]);
    $token = $stmt->fetch();
    if (!$token || !hash_equals((string) $token['token_hash'], hash('sha256', $validator))) {
        community_forget_cookie();
        return null;
    }
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $token['user_id'];
    $GLOBALS['community_current_user'] = community_user_by_id((int) $token['user_id']);
    if (!$GLOBALS['community_current_user']) {
        community_forget_cookie();
    }
    return $GLOBALS['community_current_user'];
}

function require_user(): array
{
    $user = current_user();
    if (!$user) {
        $return = safe_return_path((string) ($_SERVER['REQUEST_URI'] ?? '/'));
        header('Location: /login?return=' . rawurlencode($return));
        exit;
    }
    return $user;
}

function community_remember_user(int $userId): void
{
    $db = community_db();
    $selector = bin2hex(random_bytes(12));
    $validator = bin2hex(random_bytes(32));
    $expires = time() + (REMEMBER_COOKIE_DAYS * 86400);
    $stmt = $db->prepare('INSERT INTO remember_tokens (user_id, selector, token_hash, expires_at) VALUES (?, ?, ?, ?)');
    $stmt->execute([$userId, $selector, hash('sha256', $validator), gmdate('Y-m-d H:i:s', $expires)]);
    setcookie(REMEMBER_COOKIE_NAME, $selector . ':' . $validator, community_cookie_options($expires));
}

function community_forget_cookie(): void
{
    $cookie = (string) ($_COOKIE[REMEMBER_COOKIE_NAME] ?? '');
    if (str_contains($cookie, ':') && ($db = community_try_db())) {
        $selector = explode(':', $cookie, 2)[0];
        if (preg_match('/^[a-f0-9]{24}$/', $selector)) {
            $db->prepare('DELETE FROM remember_tokens WHERE selector = ?')->execute([$selector]);
        }
    }
    setcookie(REMEMBER_COOKIE_NAME, '', community_cookie_options(time() - 3600));
    unset($_COOKIE[REMEMBER_COOKIE_NAME]);
}

function community_login_user(int $userId): void
{
    start_secure_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    community_reset_current_user();
    community_remember_user($userId);
}

function community_logout_user(): void
{
    start_secure_session();
    community_forget_cookie();
    unset($_SESSION['user_id']);
    session_regenerate_id(true);
    community_reset_current_user();
}

function safe_return_path(string $path, string $fallback = '/'): string
{
    $path = trim($path);
    if ($path === '' || $path[0] !== '/' || str_starts_with($path, '//') || str_contains($path, "\r") || str_contains($path, "\n")) {
        return $fallback;
    }
    return $path;
}

function community_flash(string $message, string $type = 'success'): void
{
    start_secure_session();
    $_SESSION['community_flash'] = ['message' => $message, 'type' => $type];
}

function community_take_flash(): ?array
{
    start_secure_session();
    $flash = $_SESSION['community_flash'] ?? null;
    unset($_SESSION['community_flash']);
    return is_array($flash) ? $flash : null;
}

function community_slug(string $value): string
{
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    return trim(substr($value, 0, 150), '-');
}

function community_avatar_url(?array $user): string
{
    $path = trim((string) ($user['avatar_path'] ?? ''));
    return $path !== '' ? '/' . ltrim($path, '/') : '/assets/images/favicon.png';
}

function community_banner_url(?array $user): string
{
    $path = trim((string) ($user['banner_path'] ?? ''));
    return $path !== '' ? '/' . ltrim($path, '/') : '';
}

function community_profile_style(array $user): string
{
    $primary = preg_match('/^#[0-9a-f]{6}$/i', (string) ($user['accent_primary'] ?? '')) ? $user['accent_primary'] : '#f2eb00';
    $secondary = preg_match('/^#[0-9a-f]{6}$/i', (string) ($user['accent_secondary'] ?? '')) ? $user['accent_secondary'] : '#7c3aed';
    $avatarScale = min(2.0, max(1.0, (float) ($user['avatar_scale'] ?? 1)));
    $avatarX = min(100, max(0, (int) ($user['avatar_x'] ?? 50)));
    $avatarY = min(100, max(0, (int) ($user['avatar_y'] ?? 50)));
    $bannerY = min(100, max(0, (int) ($user['banner_y'] ?? 50)));
    return '--profile-primary:' . h((string) $primary) . ';--profile-secondary:' . h((string) $secondary) . ';--avatar-scale:' . $avatarScale . ';--avatar-x:' . $avatarX . '%;--avatar-y:' . $avatarY . '%;--banner-y:' . $bannerY . '%';
}

function community_render_avatar(array $user, string $size = 'medium', bool $button = true): string
{
    $image = '<span class="user-avatar ' . h($size) . '" style="' . community_profile_style($user) . '"><img src="' . h(community_avatar_url($user)) . '" alt="" loading="lazy"></span>';
    if (!$button) {
        return $image;
    }
    return '<button class="avatar-profile-trigger" type="button" data-profile-user="' . h((string) $user['username']) . '" aria-label="View ' . h((string) $user['display_name']) . '\'s profile">' . $image . '</button>';
}

function community_store_image(string $field, string $folder, int $maxBytes): ?string
{
    if (empty($_FILES[$field]) || (int) ($_FILES[$field]['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    $file = $_FILES[$field];
    if ((int) $file['error'] !== UPLOAD_ERR_OK || (int) $file['size'] < 1 || (int) $file['size'] > $maxBytes) {
        throw new RuntimeException('The image could not be uploaded or is too large.');
    }
    $info = @getimagesize((string) $file['tmp_name']);
    $mime = is_array($info) ? (string) ($info['mime'] ?? '') : '';
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    if (!isset($extensions[$mime])) {
        throw new RuntimeException('Use a JPG, PNG, WebP, or GIF image.');
    }
    $directory = __DIR__ . '/uploads/' . $folder;
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
        throw new RuntimeException('The upload directory is not writable.');
    }
    $filename = bin2hex(random_bytes(20)) . '.' . $extensions[$mime];
    if (!move_uploaded_file((string) $file['tmp_name'], $directory . '/' . $filename)) {
        throw new RuntimeException('The image could not be saved.');
    }
    return 'uploads/' . $folder . '/' . $filename;
}

function community_recent_activity(int $userId, int $limit = 6): array
{
    $db = community_try_db();
    if (!$db) {
        return [];
    }
    $limit = min(12, max(1, $limit));
    $sql = "(SELECT 'topic' AS kind, title AS label, CONCAT('/forums/', slug) AS url, created_at FROM forum_topics WHERE user_id = ?)
            UNION ALL
            (SELECT 'reply' AS kind, LEFT(body, 120) AS label, CONCAT('/forums/', t.slug, '#reply-', r.id) AS url, r.created_at FROM forum_replies r JOIN forum_topics t ON t.id = r.topic_id WHERE r.user_id = ? AND r.is_deleted = 0)
            UNION ALL
            (SELECT 'comment' AS kind, LEFT(body, 120) AS label, CONCAT('/posts/', post_slug, '#comment-', id) AS url, created_at FROM post_comments WHERE user_id = ? AND is_deleted = 0)
            ORDER BY created_at DESC LIMIT " . $limit;
    $stmt = $db->prepare($sql);
    $stmt->execute([$userId, $userId, $userId]);
    return $stmt->fetchAll() ?: [];
}

function community_profile_payload(string $username): ?array
{
    $user = community_user_by_username($username);
    if (!$user) {
        return null;
    }
    $user['activity'] = community_recent_activity((int) $user['id']);
    return $user;
}

function community_post_comments(string $postSlug): array
{
    $db = community_try_db();
    if (!$db) {
        return [];
    }
    $stmt = $db->prepare('SELECT c.id, c.user_id, c.body, c.is_deleted, c.created_at, c.updated_at, u.display_name, u.username, u.avatar_path, u.accent_primary, u.accent_secondary, u.profile_effect, u.avatar_scale, u.avatar_x, u.avatar_y, u.banner_y FROM post_comments c JOIN users u ON u.id = c.user_id WHERE c.post_slug = ? ORDER BY c.created_at ASC');
    $stmt->execute([$postSlug]);
    return $stmt->fetchAll() ?: [];
}

function render_post_comments_section(string $postSlug): void
{
    $viewer = current_user();
    $comments = community_post_comments($postSlug);
    $flash = community_take_flash();
    echo '<section class="post-comments" id="comments"><div class="comments-heading"><div><span class="eyebrow">Community</span><h2>Comments</h2></div><span>' . count($comments) . ' contribution' . (count($comments) === 1 ? '' : 's') . '</span></div>';
    if ($flash) echo '<div class="flash ' . h((string) $flash['type']) . '">' . h((string) $flash['message']) . '</div>';
    if (!community_db_configured()) {
        echo '<div class="community-unavailable">Comments will appear after the MySQL database is connected.</div></section>';
        return;
    }
    if ($viewer) {
        echo '<form method="post" action="/community-action" class="comment-composer"><input type="hidden" name="csrf" value="' . h(csrf_token()) . '"><input type="hidden" name="action" value="create_comment"><input type="hidden" name="post_slug" value="' . h($postSlug) . '"><input type="hidden" name="return_to" value="/posts/' . h($postSlug) . '#comments">' . community_render_avatar($viewer, 'medium', false) . '<label><span class="sr-only">Add a comment</span><textarea name="body" rows="3" maxlength="3000" required placeholder="Add to the conversation…"></textarea><span><small>Be constructive and stay on topic.</small><button class="button primary small" type="submit">Comment</button></span></label></form>';
    } else {
        echo '<div class="comment-login-callout"><div><strong>Join the conversation</strong><p>Log in to add, edit, and manage your comments.</p></div><a class="button primary small" href="/login?return=' . rawurlencode('/posts/' . $postSlug . '#comments') . '">Log in</a></div>';
    }
    echo '<div class="comment-list">';
    if (!$comments) {
        echo '<div class="community-empty"><span>◇</span><p>No comments yet. Start the conversation.</p></div>';
    }
    foreach ($comments as $comment) {
        $isOwner = $viewer && (int) $viewer['id'] === (int) $comment['user_id'];
        echo '<article class="comment-card" id="comment-' . (int) $comment['id'] . '">' . community_render_avatar($comment, 'medium') . '<div class="comment-body"><header><button type="button" data-profile-user="' . h((string) $comment['username']) . '"><strong>' . h((string) $comment['display_name']) . '</strong><span>@' . h((string) $comment['username']) . '</span></button><time datetime="' . h((string) $comment['created_at']) . '">' . h(community_relative_time((string) $comment['created_at'])) . '</time></header>';
        if (!empty($comment['is_deleted'])) {
            echo '<p class="deleted-copy">This comment was deleted by its author.</p>';
        } else {
            echo '<p>' . nl2br(h((string) $comment['body'])) . '</p>';
            if ($isOwner) {
                echo '<details class="comment-manage"><summary>Edit or delete</summary><form class="comment-edit-form" method="post" action="/community-action"><input type="hidden" name="csrf" value="' . h(csrf_token()) . '"><input type="hidden" name="action" value="edit_comment"><input type="hidden" name="comment_id" value="' . (int) $comment['id'] . '"><input type="hidden" name="return_to" value="/posts/' . h($postSlug) . '#comment-' . (int) $comment['id'] . '"><textarea name="body" maxlength="3000" required>' . h((string) $comment['body']) . '</textarea><button class="button small" type="submit">Save changes</button></form><form class="comment-delete-form" method="post" action="/community-action" data-confirm="Delete this comment?"><input type="hidden" name="csrf" value="' . h(csrf_token()) . '"><input type="hidden" name="action" value="delete_comment"><input type="hidden" name="comment_id" value="' . (int) $comment['id'] . '"><input type="hidden" name="return_to" value="/posts/' . h($postSlug) . '#comments"><button class="button danger small" type="submit">Delete comment</button></form></details>';
            }
        }
        echo '</div></article>';
    }
    echo '</div></section>';
}

function community_topic_by_slug(string $slug, bool $countView = false): ?array
{
    $db = community_try_db();
    if (!$db) {
        return null;
    }
    if ($countView) {
        $db->prepare('UPDATE forum_topics SET views = views + 1 WHERE slug = ?')->execute([$slug]);
    }
    $stmt = $db->prepare('SELECT t.*, u.display_name, u.username, u.avatar_path, u.banner_path, u.bio, u.accent_primary, u.accent_secondary, u.profile_effect, u.avatar_scale, u.avatar_x, u.avatar_y, u.banner_y, COALESCE(v.score, 0) AS vote_score, COALESCE(r.reply_count, 0) AS reply_count FROM forum_topics t JOIN users u ON u.id = t.user_id LEFT JOIN (SELECT topic_id, SUM(vote) AS score FROM forum_topic_votes GROUP BY topic_id) v ON v.topic_id = t.id LEFT JOIN (SELECT topic_id, COUNT(*) AS reply_count FROM forum_replies WHERE is_deleted = 0 GROUP BY topic_id) r ON r.topic_id = t.id WHERE t.slug = ? LIMIT 1');
    $stmt->execute([$slug]);
    $topic = $stmt->fetch();
    return is_array($topic) ? $topic : null;
}

function community_forum_topics(string $category = '', string $sort = 'activity'): array
{
    $db = community_try_db();
    if (!$db) {
        return [];
    }
    $where = isset(COMMUNITY_CATEGORIES[$category]) ? ' WHERE t.category = ?' : '';
    $order = $sort === 'votes' ? 'vote_score DESC, t.updated_at DESC' : ($sort === 'newest' ? 't.created_at DESC' : 't.updated_at DESC');
    $sql = 'SELECT t.*, u.display_name, u.username, u.avatar_path, u.accent_primary, u.accent_secondary, u.profile_effect, u.avatar_scale, u.avatar_x, u.avatar_y, u.banner_y, COALESCE(v.score, 0) AS vote_score, COALESCE(r.reply_count, 0) AS reply_count FROM forum_topics t JOIN users u ON u.id = t.user_id LEFT JOIN (SELECT topic_id, SUM(vote) AS score FROM forum_topic_votes GROUP BY topic_id) v ON v.topic_id = t.id LEFT JOIN (SELECT topic_id, COUNT(*) AS reply_count FROM forum_replies WHERE is_deleted = 0 GROUP BY topic_id) r ON r.topic_id = t.id' . $where . ' ORDER BY ' . $order . ' LIMIT 100';
    $stmt = $db->prepare($sql);
    $stmt->execute($where !== '' ? [$category] : []);
    return $stmt->fetchAll() ?: [];
}

function community_topic_replies(int $topicId): array
{
    $db = community_try_db();
    if (!$db) {
        return [];
    }
    $stmt = $db->prepare('SELECT r.*, u.display_name, u.username, u.avatar_path, u.banner_path, u.bio, u.accent_primary, u.accent_secondary, u.profile_effect, u.avatar_scale, u.avatar_x, u.avatar_y, u.banner_y, COALESCE(v.score, 0) AS vote_score FROM forum_replies r JOIN users u ON u.id = r.user_id LEFT JOIN (SELECT reply_id, SUM(vote) AS score FROM forum_reply_votes GROUP BY reply_id) v ON v.reply_id = r.id WHERE r.topic_id = ? ORDER BY r.created_at ASC');
    $stmt->execute([$topicId]);
    return $stmt->fetchAll() ?: [];
}

function community_category(string $key): array
{
    return COMMUNITY_CATEGORIES[$key] ?? ['Discussion', 'Community discussion.', '#92929b'];
}

function community_format_date(?string $value, string $format = 'j M Y, g:i A'): string
{
    if (!$value) {
        return 'Unknown';
    }
    try {
        return (new DateTimeImmutable($value, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone(APP_TIMEZONE))->format($format);
    } catch (Throwable) {
        return $value;
    }
}

function community_relative_time(?string $value): string
{
    if (!$value) {
        return 'recently';
    }
    try {
        $seconds = max(0, time() - (new DateTimeImmutable($value, new DateTimeZone('UTC')))->getTimestamp());
    } catch (Throwable) {
        return 'recently';
    }
    if ($seconds < 60) return 'just now';
    if ($seconds < 3600) return (int) floor($seconds / 60) . 'm ago';
    if ($seconds < 86400) return (int) floor($seconds / 3600) . 'h ago';
    if ($seconds < 604800) return (int) floor($seconds / 86400) . 'd ago';
    return community_format_date($value, 'j M Y');
}

function community_clean_text(string $value, int $max): string
{
    $value = trim(preg_replace('/\r\n?/', "\n", $value) ?? '');
    if (community_strlen($value) > $max) {
        $value = community_substr($value, 0, $max);
    }
    return $value;
}

function community_strlen(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function community_substr(string $value, int $start, int $length): string
{
    return function_exists('mb_substr') ? mb_substr($value, $start, $length, 'UTF-8') : substr($value, $start, $length);
}

function community_valid_color(string $value, string $fallback): string
{
    return preg_match('/^#[0-9a-f]{6}$/i', $value) ? strtolower($value) : $fallback;
}

function community_login_locked(string $identifier): int
{
    $db = community_db();
    $hash = hash('sha256', strtolower($identifier) . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    $stmt = $db->prepare('SELECT locked_until FROM login_attempts WHERE identifier_hash = ? LIMIT 1');
    $stmt->execute([$hash]);
    $locked = $stmt->fetchColumn();
    if (!$locked) return 0;
    return max(0, strtotime((string) $locked . ' UTC') - time());
}

function community_record_login_failure(string $identifier): void
{
    $db = community_db();
    $hash = hash('sha256', strtolower($identifier) . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    $stmt = $db->prepare("INSERT INTO login_attempts (identifier_hash, attempt_count, first_attempt_at, last_attempt_at, locked_until) VALUES (?, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP(), NULL) ON DUPLICATE KEY UPDATE attempt_count = IF(first_attempt_at < UTC_TIMESTAMP() - INTERVAL 15 MINUTE, 1, attempt_count + 1), first_attempt_at = IF(first_attempt_at < UTC_TIMESTAMP() - INTERVAL 15 MINUTE, UTC_TIMESTAMP(), first_attempt_at), last_attempt_at = UTC_TIMESTAMP(), locked_until = IF(attempt_count >= 4 AND first_attempt_at >= UTC_TIMESTAMP() - INTERVAL 15 MINUTE, UTC_TIMESTAMP() + INTERVAL 15 MINUTE, locked_until)");
    $stmt->execute([$hash]);
}

function community_clear_login_failures(string $identifier): void
{
    $db = community_db();
    $hash = hash('sha256', strtolower($identifier) . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    $db->prepare('DELETE FROM login_attempts WHERE identifier_hash = ?')->execute([$hash]);
}
