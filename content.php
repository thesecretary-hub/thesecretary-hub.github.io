<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';

$type = (string) ($_GET['type'] ?? 'post');
$slug = strtolower(trim((string) ($_GET['slug'] ?? '')));
$data = public_content($type, $slug);
if (empty($data['ok']) || !is_array($data['item'] ?? null)) {
    http_response_code(404);
    $item = ['title' => 'Page not found', 'excerpt' => 'This page is unavailable or may have moved.', 'contentHtml' => '<p>Return to the status page to find the latest information.</p>'];
} else {
    $item = $data['item'];
}
$plural = $type === 'incident' ? 'incidents' : ($type === 'maintenance' ? 'maintenance' : 'posts');
$published = $item['publishedAt'] ?? $item['startedAt'] ?? $item['startAt'] ?? $item['createdAt'] ?? null;
$contentHtml = sanitize_rich_html((string) ($item['contentHtml'] ?? ''));
$updates = is_array($item['updates'] ?? null) ? $item['updates'] : [];
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#050506"><?php render_head_meta((string) $item['title'] . ' | The Secretary Status', (string) ($item['excerpt'] ?? 'Status update from The Secretary.'), $plural . '/' . $slug); ?><link rel="stylesheet" href="/assets/style.css?v=3.1.0"></head><body>
<?php render_site_header($plural); ?>
<main class="container page document-page"><aside class="document-rail"><a href="/<?= h($plural) ?>">← All <?= h($plural) ?></a><span><?= h(ucfirst($type)) ?></span><?php if (!empty($item['status'])): ?><span class="status-pill <?= h(($item['status'] ?? '') === 'resolved' ? 'good' : (($item['impact'] ?? '') === 'critical' ? 'bad' : 'warn')) ?>"><?= h(ucfirst((string) $item['status'])) ?></span><?php endif; ?></aside><article class="document"><header class="document-hero"><span class="eyebrow"><?= h($type) ?> report</span><h1><?= h((string) $item['title']) ?></h1><p><?= h((string) ($item['excerpt'] ?? '')) ?></p><div class="document-meta"><span>Published <?= h(format_time(is_string($published) ? $published : null)) ?></span><?php if (!empty($item['updatedAt'])): ?><span>Updated <?= h(format_time((string) $item['updatedAt'])) ?></span><?php endif; ?></div></header><div class="document-divider"><img src="/assets/images/favicon.png" alt=""></div><div class="rich-content"><?= $contentHtml ?: '<p>No additional information has been published yet.</p>' ?></div><?php if ($updates): ?><section class="document-updates"><h2>Timeline</h2><?php foreach (array_reverse($updates) as $update): ?><article><span></span><div><strong><?= h(ucfirst((string) ($update['status'] ?? 'Update'))) ?></strong><p><?= nl2br(h((string) ($update['message'] ?? ''))) ?></p><small><?= h(format_time($update['createdAt'] ?? null)) ?></small></div></article><?php endforeach; ?></section><?php endif; ?><?php if ($type === 'post' && !empty($data['ok'])) render_post_comments_section($slug); ?></article></main>
<?php render_subscribe_modal(); render_site_footer(); ?><script src="/assets/app.js?v=3.1.0" defer></script></body></html>
