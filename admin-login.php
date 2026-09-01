<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
start_secure_session();

if (!empty($_SESSION['admin_authenticated'])) {
    header('Location: /admin');
    exit;
}

$error = '';
$notice = isset($_GET['expired']) ? 'Your secure session expired. Please sign in again.' : '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !hash_equals(strtolower(ADMIN_EMAIL), $email)) {
        $error = 'That email is not authorized for this dashboard.';
    } elseif (!is_configured()) {
        $error = 'Finish the private monitor setup before signing in.';
    } elseif (!empty($_SESSION['otp_last_sent']) && time() - (int) $_SESSION['otp_last_sent'] < 60) {
        $error = 'Please wait one minute before requesting another code.';
    } else {
        $code = (string) random_int(100000, 999999);
        $response = api_request('send_otp', ['code' => $code], true);
        if (!empty($response['ok'])) {
            $_SESSION['otp_hash'] = password_hash($code, PASSWORD_DEFAULT);
            $_SESSION['otp_expires'] = time() + 600;
            $_SESSION['otp_attempts'] = 0;
            $_SESSION['otp_last_sent'] = time();
            header('Location: /admin/verify');
            exit;
        }
        $error = (string) ($response['error'] ?? 'The sign-in email could not be sent.');
    }
}
?>
<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><?php render_head_meta('Admin Sign In — The Secretary Status', 'Secure owner access to The Secretary status control room.', 'admin/login', true); ?><link rel="stylesheet" href="/assets/style.css?v=3.1.0"></head><body class="auth-body admin-auth-body"><main class="auth-shell"><a class="brand auth-brand" href="/"><span class="brand-mark"><img src="/assets/images/favicon.png" alt=""></span><span><strong>The Secretary</strong><small>Owner access</small></span></a><section class="auth-card"><span class="eyebrow">Private control room</span><h1>Admin sign in</h1><p>Enter the one authorized email. A six-digit owner code will be sent privately.</p><?php if ($notice): ?><div class="alert info"><?= h($notice) ?></div><?php endif; ?><?php if ($error): ?><div class="alert error"><?= h($error) ?></div><?php endif; ?><form method="post" class="stack-form"><input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><label for="email">Authorized email</label><input id="email" name="email" type="email" autocomplete="email" required autofocus><button class="button primary wide" type="submit">Send secure code</button></form><p class="auth-note">This owner login is separate from public community accounts.</p></section><a class="quiet-link" href="/login">Community login →</a></main></body></html>
