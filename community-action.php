<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit('POST required.'); }
verify_csrf();
$user = require_user();
$db = community_db();
$action = (string) ($_POST['action'] ?? '');
$returnTo = safe_return_path((string) ($_POST['return_to'] ?? '/'));

try {
    switch ($action) {
        case 'update_profile':
            $name = community_clean_text((string) ($_POST['display_name'] ?? ''), 80);
            $bio = community_clean_text((string) ($_POST['bio'] ?? ''), 600);
            if (community_strlen($name) < 2) throw new RuntimeException('Display name must contain at least two characters.');
            $primary = community_valid_color((string) ($_POST['accent_primary'] ?? ''), '#f2eb00');
            $secondary = community_valid_color((string) ($_POST['accent_secondary'] ?? ''), '#7c3aed');
            $effects = ['aurora', 'nebula', 'ember', 'ocean', 'none'];
            $effect = in_array((string) ($_POST['profile_effect'] ?? ''), $effects, true) ? (string) $_POST['profile_effect'] : 'aurora';
            $scale = min(2.0, max(1.0, (float) ($_POST['avatar_scale'] ?? 1)));
            $avatarX = min(100, max(0, (int) ($_POST['avatar_x'] ?? 50)));
            $avatarY = min(100, max(0, (int) ($_POST['avatar_y'] ?? 50)));
            $bannerY = min(100, max(0, (int) ($_POST['banner_y'] ?? 50)));
            $avatar = community_store_image('avatar', 'avatars', 5 * 1024 * 1024);
            $banner = community_store_image('banner', 'banners', 8 * 1024 * 1024);
            $sql = 'UPDATE users SET display_name = ?, bio = ?, accent_primary = ?, accent_secondary = ?, profile_effect = ?, avatar_scale = ?, avatar_x = ?, avatar_y = ?, banner_y = ?';
            $values = [$name, $bio, $primary, $secondary, $effect, $scale, $avatarX, $avatarY, $bannerY];
            if ($avatar) { $sql .= ', avatar_path = ?'; $values[] = $avatar; }
            if ($banner) { $sql .= ', banner_path = ?'; $values[] = $banner; }
            $sql .= ' WHERE id = ?'; $values[] = (int) $user['id'];
            $db->prepare($sql)->execute($values);
            community_reset_current_user();
            community_flash('Your profile has been updated.');
            break;

        case 'create_comment':
            $slug = strtolower(trim((string) ($_POST['post_slug'] ?? '')));
            $body = community_clean_text((string) ($_POST['body'] ?? ''), 3000);
            if (!preg_match('/^[a-z0-9][a-z0-9-]{0,119}$/', $slug) || $body === '') throw new RuntimeException('Write a comment before posting.');
            $cooldown = $db->prepare('SELECT 1 FROM post_comments WHERE user_id = ? AND created_at > UTC_TIMESTAMP() - INTERVAL 15 SECOND LIMIT 1');
            $cooldown->execute([(int) $user['id']]);
            if ($cooldown->fetchColumn()) throw new RuntimeException('Wait a few seconds before posting another comment.');
            $db->prepare('INSERT INTO post_comments (post_slug, user_id, body) VALUES (?, ?, ?)')->execute([$slug, (int) $user['id'], $body]);
            community_flash('Comment posted.');
            break;

        case 'edit_comment':
            $id = (int) ($_POST['comment_id'] ?? 0);
            $body = community_clean_text((string) ($_POST['body'] ?? ''), 3000);
            if ($body === '') throw new RuntimeException('A comment cannot be empty.');
            $stmt = $db->prepare('UPDATE post_comments SET body = ? WHERE id = ? AND user_id = ? AND is_deleted = 0');
            $stmt->execute([$body, $id, (int) $user['id']]);
            if ($stmt->rowCount() < 1) throw new RuntimeException('That comment could not be edited.');
            community_flash('Comment updated.');
            break;

        case 'delete_comment':
            $id = (int) ($_POST['comment_id'] ?? 0);
            $stmt = $db->prepare("UPDATE post_comments SET body = '', is_deleted = 1 WHERE id = ? AND user_id = ? AND is_deleted = 0");
            $stmt->execute([$id, (int) $user['id']]);
            if ($stmt->rowCount() < 1) throw new RuntimeException('That comment could not be deleted.');
            community_flash('Comment deleted.');
            break;

        case 'create_topic':
            $category = (string) ($_POST['category'] ?? '');
            $title = community_clean_text((string) ($_POST['title'] ?? ''), 160);
            $body = community_clean_text((string) ($_POST['body'] ?? ''), 20000);
            if (!isset(COMMUNITY_CATEGORIES[$category])) throw new RuntimeException('Choose a forum category.');
            if (community_strlen($title) < 6 || community_strlen($body) < 10) throw new RuntimeException('Add a clear title and enough detail for others to help.');
            $cooldown = $db->prepare('SELECT 1 FROM forum_topics WHERE user_id = ? AND created_at > UTC_TIMESTAMP() - INTERVAL 60 SECOND LIMIT 1');
            $cooldown->execute([(int) $user['id']]);
            if ($cooldown->fetchColumn()) throw new RuntimeException('Wait one minute before starting another discussion.');
            $baseSlug = community_slug($title) ?: 'discussion';
            $slug = $baseSlug . '-' . substr(bin2hex(random_bytes(4)), 0, 7);
            $db->prepare('INSERT INTO forum_topics (user_id, category, title, slug, body) VALUES (?, ?, ?, ?, ?)')->execute([(int) $user['id'], $category, $title, $slug, $body]);
            community_flash('Your discussion is live.');
            $returnTo = '/forums/' . $slug;
            break;

        case 'reply':
            $topicId = (int) ($_POST['topic_id'] ?? 0);
            $parentId = (int) ($_POST['parent_id'] ?? 0);
            $body = community_clean_text((string) ($_POST['body'] ?? ''), 10000);
            $stmt = $db->prepare('SELECT id, slug, status FROM forum_topics WHERE id = ? LIMIT 1');
            $stmt->execute([$topicId]); $topic = $stmt->fetch();
            if (!$topic || $topic['status'] === 'closed') throw new RuntimeException('This discussion is closed.');
            if ($body === '') throw new RuntimeException('Write a reply first.');
            $cooldown = $db->prepare('SELECT 1 FROM forum_replies WHERE user_id = ? AND created_at > UTC_TIMESTAMP() - INTERVAL 10 SECOND LIMIT 1');
            $cooldown->execute([(int) $user['id']]);
            if ($cooldown->fetchColumn()) throw new RuntimeException('Wait a few seconds before posting another reply.');
            if ($parentId > 0) {
                $parent = $db->prepare('SELECT id FROM forum_replies WHERE id = ? AND topic_id = ? AND is_deleted = 0');
                $parent->execute([$parentId, $topicId]);
                if (!$parent->fetchColumn()) throw new RuntimeException('The reply you selected is unavailable.');
            }
            $db->prepare('INSERT INTO forum_replies (topic_id, user_id, parent_id, body) VALUES (?, ?, ?, ?)')->execute([$topicId, (int) $user['id'], $parentId ?: null, $body]);
            $replyId = (int) $db->lastInsertId();
            $db->prepare('UPDATE forum_topics SET updated_at = UTC_TIMESTAMP() WHERE id = ?')->execute([$topicId]);
            community_flash('Reply posted.');
            $returnTo = '/forums/' . $topic['slug'] . '#reply-' . $replyId;
            break;

        case 'vote_topic':
            $topicId = (int) ($_POST['topic_id'] ?? 0); $vote = (int) ($_POST['vote'] ?? 0);
            if (!in_array($vote, [-1, 1], true)) throw new RuntimeException('Invalid vote.');
            $existing = $db->prepare('SELECT vote FROM forum_topic_votes WHERE topic_id = ? AND user_id = ?');
            $existing->execute([$topicId, (int) $user['id']]); $current = $existing->fetchColumn();
            if ($current !== false && (int) $current === $vote) {
                $db->prepare('DELETE FROM forum_topic_votes WHERE topic_id = ? AND user_id = ?')->execute([$topicId, (int) $user['id']]);
            } else {
                $db->prepare('INSERT INTO forum_topic_votes (topic_id, user_id, vote) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vote = VALUES(vote), updated_at = UTC_TIMESTAMP()')->execute([$topicId, (int) $user['id'], $vote]);
            }
            break;

        case 'vote_reply':
            $replyId = (int) ($_POST['reply_id'] ?? 0); $vote = (int) ($_POST['vote'] ?? 0);
            if (!in_array($vote, [-1, 1], true)) throw new RuntimeException('Invalid vote.');
            $existing = $db->prepare('SELECT vote FROM forum_reply_votes WHERE reply_id = ? AND user_id = ?');
            $existing->execute([$replyId, (int) $user['id']]); $current = $existing->fetchColumn();
            if ($current !== false && (int) $current === $vote) {
                $db->prepare('DELETE FROM forum_reply_votes WHERE reply_id = ? AND user_id = ?')->execute([$replyId, (int) $user['id']]);
            } else {
                $db->prepare('INSERT INTO forum_reply_votes (reply_id, user_id, vote) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vote = VALUES(vote), updated_at = UTC_TIMESTAMP()')->execute([$replyId, (int) $user['id'], $vote]);
            }
            break;

        case 'toggle_topic':
            $topicId = (int) ($_POST['topic_id'] ?? 0);
            $owned = $db->prepare('SELECT status FROM forum_topics WHERE id = ? AND user_id = ? LIMIT 1');
            $owned->execute([$topicId, (int) $user['id']]);
            $currentStatus = $owned->fetchColumn();
            if ($currentStatus === false) throw new RuntimeException('Only the original poster can close this discussion.');
            $nextStatus = $currentStatus === 'closed' ? 'open' : 'closed';
            $db->prepare('UPDATE forum_topics SET status = ? WHERE id = ?')->execute([$nextStatus, $topicId]);
            community_flash('Discussion status updated.');
            break;

        case 'mark_solution':
            $topicId = (int) ($_POST['topic_id'] ?? 0); $replyId = (int) ($_POST['reply_id'] ?? 0);
            $check = $db->prepare('SELECT r.id FROM forum_replies r JOIN forum_topics t ON t.id = r.topic_id WHERE r.id = ? AND r.topic_id = ? AND r.is_deleted = 0 AND t.user_id = ?');
            $check->execute([$replyId, $topicId, (int) $user['id']]);
            if (!$check->fetchColumn()) throw new RuntimeException('Only the original poster can mark a reply as the solution.');
            $db->prepare("UPDATE forum_topics SET solution_reply_id = ?, status = 'solved' WHERE id = ?")->execute([$replyId, $topicId]);
            community_flash('Reply marked as the solution.');
            break;

        default:
            throw new RuntimeException('Unknown community action.');
    }
} catch (Throwable $error) {
    error_log('[The Secretary Community] Action ' . $action . ' failed: ' . $error->getMessage());
    community_flash($error instanceof RuntimeException ? $error->getMessage() : 'That action could not be completed.', 'error');
}
header('Location: ' . $returnTo);
exit;
