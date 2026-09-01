<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
start_secure_session();
$returnTo = safe_return_path((string) ($_GET['return'] ?? $_POST['return_to'] ?? '/'));
if (current_user()) { header('Location: ' . $returnTo); exit; }
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $identifier = strtolower(trim((string) ($_POST['identifier'] ?? '')));
    $password = (string) ($_POST['password'] ?? '');
    try {
        if (community_login_locked($identifier) > 0) {
            $error = 'Too many attempts. Try again in 15 minutes.';
        } else {
            $db = community_db();
            $stmt = $db->prepare('SELECT id, password_hash FROM users WHERE email = ? OR username = ? LIMIT 1');
            $stmt->execute([$identifier, $identifier]);
            $account = $stmt->fetch();
            if (!$account || !password_verify($password, (string) $account['password_hash'])) {
                community_record_login_failure($identifier);
                $error = 'The email, username, or password is incorrect.';
            } else {
                community_clear_login_failures($identifier);
                community_login_user((int) $account['id']);
                $db->prepare('UPDATE users SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?')->execute([(int) $account['id']]);
                header('Location: ' . $returnTo); exit;
            }
        }
    } catch (Throwable $exception) {
        error_log('[The Secretary Community] Login failed: ' . $exception->getMessage());
        $error = community_db_configured() ? 'Login is temporarily unavailable.' : 'Community setup is not complete yet.';
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#050506">
  <?php render_head_meta('Log in — The Secretary Community', 'Log in to join discussions and manage your profile.', 'login', true); ?>
  <link rel="stylesheet" href="/assets/style.css?v=3.1.0">
</head>
<body class="community-auth-body portal-auth-body">
  <?php render_site_header(); ?>
  <main class="account-portal">
    <section class="account-form-pane">
      <div class="account-form-inner">
        <span class="portal-kicker">Account access&nbsp; // &nbsp;Secure channel</span>
        <h1>Welcome<br>back.</h1>
        <p class="portal-intro">Log in to continue your conversations.</p>
        <div class="portal-safety"><span>♦</span> Never share your password or authentication details.</div>
        <?php if ($error): ?><div class="alert error"><?= h($error) ?></div><?php endif; ?>
        <form method="post" class="portal-form">
          <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="return_to" value="<?= h($returnTo) ?>">
          <label><span><b>01</b> Email or username</span><input name="identifier" autocomplete="username" required autofocus value="<?= h((string) ($_POST['identifier'] ?? '')) ?>" placeholder="Enter your email or username"></label>
          <label><span><b>02</b> Password</span><input name="password" type="password" autocomplete="current-password" required placeholder="Enter your password"></label>
          <button class="portal-submit" type="submit"><span>Log in securely</span><b>→</b></button>
        </form>
        <div class="portal-form-footer"><a href="/register<?= $returnTo !== '/' ? '?return=' . rawurlencode($returnTo) : '' ?>">Create an account</a><span>Remembered securely for 30 days</span></div>
      </div>
    </section>
    <aside class="account-image-pane" aria-label="The Secretary community">
      <div class="account-image-number" aria-hidden="true">01</div>
      <div class="account-image-caption"><span>♟ 25K R$ &nbsp;|&nbsp; The Secretary™ // Account access</span><h2>Your place in the conversation is waiting.</h2></div>
    </aside>
  </main>
  <script src="/assets/app.js?v=3.1.0" defer></script>
</body></html>
