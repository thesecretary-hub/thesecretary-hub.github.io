<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
start_secure_session();
unset($_SESSION['admin_authenticated'], $_SESSION['authenticated_at'], $_SESSION['otp_hash'], $_SESSION['otp_expires'], $_SESSION['otp_attempts'], $_SESSION['otp_email']);
session_regenerate_id(true);
header('Location: /admin/login');
exit;
