<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';

$type = (string) ($_GET['type'] ?? 'incidents');
$labels = [
    'incidents' => ['Incident archive', 'Every published incident and recovery report.'],
    'maintenance' => ['Maintenance windows', 'Planned work, active windows, and concluded maintenance.'],
    'posts' => ['System posts', 'Engineering notes, product updates, and public notices.'],
];
if (!isset($labels[$type])) {
    http_response_code(404);
    $type = 'incidents';
}
$data = public_archive($type);
$items = is_array($data['items'] ?? null) ? $data['items'] : [];
[$title, $description] = $labels[$type];
$detailType = $type === 'incidents' ? 'incidents' : $type;
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#050506"><?php render_head_meta($title . ' — The Secretary Status', $description, $type); ?><link rel="stylesheet" href="/assets/style.css?v=3.1.0"></head><body>
<?php render_site_header($type); ?>
<main class="container page archive-page"><section class="document-hero"><span class="eyebrow"><?= h($type) ?></span><h1><?= h($title) ?></h1><p><?= h($description) ?></p></section><div class="archive-toolbar"><span><?= count($items) ?> published</span><a href="/">← Return to status</a></div><div class="entry-list archive-list"><?php if (!$items): ?><div class="empty-card">Nothing has been published here yet.</div><?php else: foreach ($items as $item): $date = $item['publishedAt'] ?? $item['resolvedAt'] ?? $item['startAt'] ?? $item['startedAt'] ?? $item['createdAt'] ?? null; ?><a class="entry-row" href="/<?= h($detailType) ?>/<?= h((string) ($item['slug'] ?? '')) ?>"><span class="entry-date"><?= h(format_time(is_string($date) ? $date : null, 'j M Y')) ?></span><div><h2><?= h((string) ($item['title'] ?? 'Untitled')) ?></h2><p><?= h((string) ($item['excerpt'] ?? $item['description'] ?? ucfirst((string) ($item['status'] ?? 'Published')))) ?></p></div><span class="entry-arrow">↗</span></a><?php endforeach; endif; ?></div></main>
<?php render_subscribe_modal(); render_site_footer(); ?><script src="/assets/app.js?v=3.1.0" defer></script></body></html>
