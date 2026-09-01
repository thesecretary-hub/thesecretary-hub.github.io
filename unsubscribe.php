<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
$token = trim((string) ($_GET['token'] ?? ''));
$response = $token !== '' ? api_request('unsubscribe', ['token' => $token]) : ['ok' => false];
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/assets/style.css?v=2.1.0"><title>Subscription — The Secretary Status</title></head><body class="auth-body"><main class="auth-shell"><a class="brand auth-brand" href="/"><span class="brand-mark"><img src="/assets/images/favicon.png" alt=""></span><span><strong>The Secretary</strong><small>Status</small></span></a><section class="auth-card"><span class="eyebrow">Notifications</span><h1><?= !empty($response['ok']) ? 'Unsubscribed.' : 'Link unavailable.' ?></h1><p><?= !empty($response['ok']) ? 'This email will no longer receive status notifications.' : 'This unsubscribe link is invalid or has already expired.' ?></p><a class="button primary" href="/">Return to status</a></section></main></body></html>
