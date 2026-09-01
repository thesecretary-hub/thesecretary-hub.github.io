<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';

$state = public_status_state();
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
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#2B2D31">
  <?php render_head_meta(
      'The Secretary Systems | Live',
      'Official The Secretary systems page, know about any dowtime or any ongoing maintenance service'
  ); ?>
  <link rel="stylesheet" href="/assets/style.css?v=3.1.0">
</head>
<body>
  <?php render_site_header('status'); ?>

  <div id="live-status-region" data-live-status data-endpoint="/live-status" aria-live="polite" aria-busy="false">
    <?php require __DIR__ . '/status-content.php'; ?>
  </div>

  <?php render_subscribe_modal(); render_site_footer(); ?>
  <script src="/assets/app.js?v=3.1.0" defer></script>
</body>
</html>
