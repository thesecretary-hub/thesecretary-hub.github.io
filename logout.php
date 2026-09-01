<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
community_logout_user();
header('Location: /');
exit;
