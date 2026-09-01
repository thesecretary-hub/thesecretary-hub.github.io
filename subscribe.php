<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /');
    exit;
}
$email = strtolower(trim((string) ($_POST['email'] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || empty($_POST['consent'])) {
    header('Location: /?subscription=invalid');
    exit;
}
$response = api_request('subscribe', ['email' => $email]);
header('Location: /?subscription=' . (!empty($response['ok']) ? 'success' : 'error'));
exit;
