<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Robots-Tag: noindex, nofollow');

$state = public_status_state();
$feedState = !empty($state['usingCached']) ? 'cached' : (!empty($state['available']) ? 'live' : 'unavailable');
header('X-The-Secretary-Status-Feed: ' . $feedState);
if ($feedState === 'unavailable') {
    http_response_code(503);
    header('Retry-After: 15');
}
$data = $state['data'];
$available = $state['available'];
$monitor = $state['monitor'];
$summary = $state['summary'];
$incidents = $state['incidents'];
$maintenance = $state['maintenance'];
$posts = $state['posts'];
$discordApi = $state['discordApi'];
$uptime = $state['uptime'];
$response = $state['response'];
$currentStatus = $state['currentStatus'];
$statusClass = $state['statusClass'];
$headline = $state['headline'];
$summaryText = $state['summaryText'];
$unresolved = $state['unresolved'];
$resolved = $state['resolved'];
$activeMaintenance = $state['activeMaintenance'];
$history = $state['history'];

require __DIR__ . '/status-content.php';
