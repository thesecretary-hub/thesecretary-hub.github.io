<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
start_secure_session();
if (empty($_SESSION['otp_hash']) || empty($_SESSION['otp_expires'])) { header('Location: /admin/login'); exit; }
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $code = preg_replace('/\D/', '', (string) ($_POST['code'] ?? ''));
    $_SESSION['otp_attempts'] = (int) ($_SESSION['otp_attempts'] ?? 0) + 1;
    if (time() > (int) $_SESSION['otp_expires']) {
        unset($_SESSION['otp_hash'], $_SESSION['otp_expires'], $_SESSION['otp_attempts']);
        $error = 'That code expired. Request a new one.';
    } elseif ((int) $_SESSION['otp_attempts'] > 5) {
        unset($_SESSION['otp_hash'], $_SESSION['otp_expires'], $_SESSION['otp_attempts']);
        $error = 'Too many attempts. Request a fresh code.';
    } elseif (strlen($code) !== 6 || !password_verify($code, (string) $_SESSION['otp_hash'])) {
        $error = 'The code is incorrect.';
    } else {
        session_regenerate_id(true);
        $_SESSION['admin_authenticated'] = true;
        $_SESSION['authenticated_at'] = time();
        unset($_SESSION['otp_hash'], $_SESSION['otp_expires'], $_SESSION['otp_attempts'], $_SESSION['otp_email']);
        header('Location: /admin'); exit;
    }
}
?>
<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><?php render_head_meta('Enter Admin Code — The Secretary Status', 'Complete owner authentication.', 'admin/verify', true); ?><link rel="stylesheet" href="/assets/style.css?v=3.1.0"></head><body class="auth-body admin-auth-body"><main class="auth-shell"><a class="brand auth-brand" href="/"><span class="brand-mark"><img src="/assets/images/favicon.png" alt=""></span><span><strong>The Secretary</strong><small>Owner access</small></span></a><section class="auth-card"><span class="eyebrow">Check your inbox</span><h1>Enter the code</h1><p>A six-digit code was sent to the owner email.</p><?php if ($error): ?><div class="alert error"><?= h($error) ?></div><?php endif; ?><form method="post" class="stack-form"><input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><label for="code">Security code</label><input class="otp-input" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required autofocus><button class="button primary wide" type="submit">Open control room</button></form><a class="quiet-link centered" href="/admin/login">Request another code</a></section></main></body></html>
