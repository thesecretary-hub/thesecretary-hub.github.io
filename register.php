<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
start_secure_session();
$returnTo = safe_return_path((string) ($_GET['return'] ?? $_POST['return_to'] ?? '/'));
if (current_user()) { header('Location: ' . $returnTo); exit; }
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $name = community_clean_text((string) ($_POST['display_name'] ?? ''), 80);
    $username = strtolower(trim((string) ($_POST['username'] ?? '')));
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $password = (string) ($_POST['password'] ?? '');
    $confirmation = (string) ($_POST['password_confirm'] ?? '');
    if (community_strlen($name) < 2) {
        $error = 'Enter your name.';
    } elseif (!preg_match('/^[a-z0-9_]{3,32}$/', $username)) {
        $error = 'Username must be 3–32 characters using letters, numbers, or underscores.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
        $error = 'Enter a valid email address.';
    } elseif (strlen($password) < 8 || strlen($password) > 72) {
        $error = 'Password must be between 8 and 72 characters.';
    } elseif (!hash_equals($password, $confirmation)) {
        $error = 'The passwords do not match.';
    } else {
        try {
            $db = community_db();
            $check = $db->prepare('SELECT username, email FROM users WHERE username = ? OR email = ? LIMIT 1');
            $check->execute([$username, $email]);
            $existing = $check->fetch();
            if ($existing) {
                $error = strtolower((string) $existing['username']) === $username ? 'That username is already taken.' : 'An account already uses that email.';
            } else {
                $stmt = $db->prepare('INSERT INTO users (display_name, username, email, password_hash, last_seen_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())');
                $stmt->execute([$name, $username, $email, password_hash($password, PASSWORD_DEFAULT)]);
                community_login_user((int) $db->lastInsertId());
                community_flash('Welcome to The Secretary community, ' . $name . '.');
                header('Location: ' . $returnTo); exit;
            }
        } catch (Throwable $exception) {
            error_log('[The Secretary Community] Registration failed: ' . $exception->getMessage());
            $error = community_db_configured() ? 'Registration is temporarily unavailable.' : 'Community setup is not complete yet.';
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#050506">
  <?php render_head_meta('Register — The Secretary Community', 'Create your community account.', 'register', true); ?>
  <link rel="stylesheet" href="/assets/style.css?v=3.1.0">
</head>
<body class="community-auth-body portal-auth-body">
  <?php render_site_header(); ?>
  <main class="account-portal">
    <section class="account-form-pane">
      <div class="account-form-inner register-form-inner">
        <span class="portal-kicker">Account request&nbsp; // &nbsp;Secure channel</span>
        <h1>Create<br>account.</h1>
        <p class="portal-intro">One profile for posts, comments, and forums.</p>
        <div class="portal-safety"><span>♦</span> Never share passwords, authentication codes, or private keys.</div>
        <?php if ($error): ?><div class="alert error"><?= h($error) ?></div><?php endif; ?>
        <form method="post" class="portal-form register-portal-form">
          <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="return_to" value="<?= h($returnTo) ?>">
          <div class="portal-field-pair"><label><span><b>01</b> Name</span><input name="display_name" autocomplete="name" required maxlength="80" value="<?= h((string) ($_POST['display_name'] ?? '')) ?>" placeholder="Your name"></label><label><span><b>02</b> Username</span><input name="username" autocomplete="username" required minlength="3" maxlength="32" pattern="[a-zA-Z0-9_]+" value="<?= h((string) ($_POST['username'] ?? '')) ?>" placeholder="Your username"></label></div>
          <label><span><b>03</b> Email</span><input name="email" type="email" autocomplete="email" required maxlength="254" value="<?= h((string) ($_POST['email'] ?? '')) ?>" placeholder="you@example.com"></label>
          <div class="portal-field-pair"><label><span><b>04</b> Password</span><input name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="72" placeholder="At least 8 characters"></label><label><span><b>05</b> Confirm password</span><input name="password_confirm" type="password" autocomplete="new-password" required minlength="8" maxlength="72" placeholder="Repeat your password"></label></div>
          <button class="portal-submit" type="submit"><span>Create account</span><b>→</b></button>
        </form>
        <div class="portal-form-footer"><a href="/login<?= $returnTo !== '/' ? '?return=' . rawurlencode($returnTo) : '' ?>">Already registered? Log in</a><span>Stored securely in the community database</span></div>
      </div>
    </section>
    <aside class="account-image-pane" aria-label="The Secretary community">
      <div class="account-image-number" aria-hidden="true">02</div>
      <div class="account-image-caption"><span>♟ 25K R$ &nbsp;|&nbsp; The Secretary™ // New member</span><h2>Some conversations deserve a considered beginning.</h2></div>
    </aside>
  </main>
  <script src="/assets/app.js?v=3.1.0" defer></script>
</body></html>
