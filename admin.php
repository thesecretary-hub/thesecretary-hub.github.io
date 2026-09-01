<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
require_admin();

$data = api_request('admin_status', [], true);
$available = !empty($data['ok']);
$monitor = is_array($data['monitor'] ?? null) ? $data['monitor'] : [];
$summary = is_array($data['summary'] ?? null) ? $data['summary'] : [];
$checks = is_array($data['recentChecks'] ?? null) ? $data['recentChecks'] : [];
$host = is_array($data['hostManagement'] ?? null) ? $data['hostManagement'] : [];
$servers = is_array($host['servers'] ?? null) ? $host['servers'] : [];
$switchState = is_array($host['switchState'] ?? null) ? $host['switchState'] : null;
$activeServer = null;
foreach ($servers as $server) {
    if (!empty($server['active'])) { $activeServer = $server; break; }
}
$currentStatus = (string) ($summary['status'] ?? $monitor['status'] ?? 'unknown');
$csrf = csrf_token();
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#050506"><?php render_head_meta('Control Room — The Secretary Status','Private monitoring and infrastructure overview.','admin',true); ?><link rel="stylesheet" href="/assets/style.css?v=3.0.0"></head>
<body class="admin-body"><?php render_admin_header('overview'); ?>
<main class="container wide admin-page">
  <div class="admin-intro"><div><span class="eyebrow">Private dashboard</span><h1>System control room.</h1><p>Health, latency, active infrastructure, and automated failover at a glance.</p></div><form action="/action" method="post"><input type="hidden" name="csrf" value="<?= h($csrf) ?>"><input type="hidden" name="return_to" value="/admin"><input type="hidden" name="action" value="check_now"><button class="button primary" type="submit">Run all checks now</button></form></div>
  <?php render_admin_nav('overview'); render_admin_flash(); ?>
  <?php if (!$available): ?><div class="flash error"><strong>Monitor service unavailable.</strong> <?= h((string) ($data['error'] ?? 'Check the backend configuration.')) ?></div><?php endif; ?>
  <?php if (!empty($host['emergency'])): ?><div class="host-emergency"><strong>Automatic failover stopped</strong><p>Both allowed switch attempts failed. The administrator email has been notified and manual intervention is required.</p><a class="button small danger" href="/admin/servers">Open servers</a></div><?php endif; ?>

  <section class="admin-metrics admin-metrics-4">
    <article><span class="status-pill <?= h(status_class($currentStatus)) ?>"><span class="status-dot"></span><?= h(status_label($currentStatus)) ?></span><strong><?= h((string) ($monitor['name'] ?? 'The Secretary')) ?></strong><small>Last check <?= h(format_time($monitor['lastCheckAt'] ?? null)) ?></small></article>
    <article><span>30-day uptime</span><strong><?= h(percent_or_dash($monitor['uptime']['30'] ?? null)) ?></strong><small>Completed checks only</small></article>
    <article><span>Active host</span><strong><?= h((string) ($activeServer['name'] ?? 'Not identified')) ?></strong><small><?= h((string) ($activeServer['region'] ?? 'Refresh server inventory')) ?></small></article>
    <article><span>Subscribers</span><strong><?= h((string) ($data['subscriberCount'] ?? 0)) ?></strong><small>Operational and editorial alerts</small></article>
  </section>

  <?php if ($switchState): ?><section class="switch-progress"><div><span class="eyebrow">Host switch in progress</span><h2><?= h(ucfirst((string) ($switchState['phase'] ?? 'working'))) ?></h2><p><?= h((string) ($switchState['reason'] ?? 'Infrastructure transition')) ?></p></div><div class="switch-progress-meta"><strong>Attempt <?= h((string) ($switchState['attempts'] ?? 1)) ?>/<?= h((string) ($switchState['maxAttempts'] ?? 2)) ?></strong><span>Target: <?= h((string) ($switchState['targetKey'] ?? '—')) ?></span><?php if (!empty($switchState['validateAfter'])): ?><small>Validation ends <?= h(format_time((string) $switchState['validateAfter'])) ?></small><?php endif; ?></div></section><?php endif; ?>

  <div class="admin-grid">
    <section class="panel span-7"><div class="panel-heading"><div><span class="eyebrow">Latest probes</span><h2>Ping reports</h2></div><span><?= count($checks) ?> available</span></div><div class="table-wrap"><table><thead><tr><th>HTTP</th><th>Discord</th><th>Checked</th><th>Response</th><th>Code</th></tr></thead><tbody><?php if (!$checks): ?><tr><td colspan="5" class="empty-cell">No checks recorded yet.</td></tr><?php else: foreach (array_slice($checks,0,20) as $check): ?><tr><td><span class="mini-result <?= !empty($check['up']) ? 'good' : 'bad' ?>"><?= !empty($check['up']) ? 'UP' : 'DOWN' ?></span></td><td><span class="mini-result <?= empty($check['discordRateLimited']) ? 'good' : 'bad' ?>"><?= empty($check['discordRateLimited']) ? h(strtoupper((string) ($check['discordState'] ?? 'OK'))) : '429' ?></span></td><td><?= h(format_time($check['checkedAt'] ?? null,'j M, g:i A')) ?></td><td><?= h(format_duration_ms($check['responseMs'] ?? null)) ?></td><td><?= h((string) ($check['statusCode'] ?? '—')) ?></td></tr><?php endforeach; endif; ?></tbody></table></div></section>
    <section class="panel span-5"><div class="panel-heading"><div><span class="eyebrow">Infrastructure</span><h2>Render fleet</h2></div><a class="section-link" href="/admin/servers">Manage →</a></div><div class="fleet-mini-list"><?php if (!$servers): ?><div class="empty-card">Server inventory has not been loaded.</div><?php else: foreach ($servers as $server): ?><article><span class="fleet-light <?= !empty($server['active']) ? 'active' : (!empty($server['offlineUntil']) ? 'offline' : '') ?>"></span><div><strong><?= h((string) ($server['name'] ?? 'Render server')) ?></strong><small><?= h(!empty($server['active']) ? 'Active host' : (!empty($server['offlineUntil']) ? 'Offline until ' . format_time((string) $server['offlineUntil']) : (!empty($server['suspended']) ? 'Suspended standby' : 'Standby'))) ?></small></div><span><?= isset($server['bandwidthRemainingPercent']) && is_numeric($server['bandwidthRemainingPercent']) ? h(number_format((float) $server['bandwidthRemainingPercent'],1)) . '%' : '—' ?></span></article><?php endforeach; endif; ?></div></section>
  </div>
</main><script src="/assets/app.js?v=3.0.0" defer></script></body></html>
