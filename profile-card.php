<?php
declare(strict_types=1);
require_once __DIR__ . '/lib.php';
header('Cache-Control: private, no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow');
$username = strtolower(trim((string) ($_GET['user'] ?? '')));
$profile = preg_match('/^[a-z0-9_]{3,32}$/', $username) ? community_profile_payload($username) : null;
if (!$profile) {
    http_response_code(404);
    echo '<div class="profile-not-found"><h2>Profile unavailable</h2><p>This member could not be found.</p></div>';
    exit;
}
$viewer = current_user();
$isOwn = $viewer && (int) $viewer['id'] === (int) $profile['id'];
$effect = in_array((string) $profile['profile_effect'], ['aurora', 'nebula', 'ember', 'ocean', 'none'], true) ? (string) $profile['profile_effect'] : 'aurora';
$banner = community_banner_url($profile);
$activity = is_array($profile['activity'] ?? null) ? $profile['activity'] : [];
?>
<article class="profile-card-full effect-<?= h($effect) ?>" style="<?= community_profile_style($profile) ?>">
  <div class="profile-card-atmosphere" aria-hidden="true"></div>
  <header class="profile-card-banner"<?= $banner ? ' style="background-image:url(\'' . h($banner) . '\')"' : '' ?>></header>
  <div class="profile-card-columns">
    <section class="profile-card-identity">
      <?= community_render_avatar($profile, 'hero', false) ?>
      <div class="profile-name-line"><div><h2><?= h((string) $profile['display_name']) ?></h2><span>@<?= h((string) $profile['username']) ?></span></div><span class="profile-spark" title="Customized profile">✦</span></div>
      <?php if ($profile['bio']): ?><p class="profile-bio"><?= nl2br(h((string) $profile['bio'])) ?></p><?php else: ?><p class="profile-bio muted">This profile is still being written.</p><?php endif; ?>
      <dl class="profile-facts"><div><dt>Member since</dt><dd><?= h(community_format_date((string) $profile['created_at'], 'j M Y')) ?></dd></div><div><dt>Role</dt><dd><?= h(ucfirst((string) $profile['role'])) ?></dd></div></dl>
      <?php if ($isOwn): ?><div class="profile-own-actions"><button class="button primary" type="button" data-edit-profile>Edit profile</button><a class="button danger" href="/logout">Log out</a></div><?php endif; ?>
    </section>
    <section class="profile-activity-panel"><div class="profile-tab-line"><strong>Activity</strong><span><?= count($activity) ?> recent</span></div><div class="profile-activity-list"><?php if (!$activity): ?><div class="profile-empty-activity"><span>◇</span><p>No public activity yet.</p></div><?php else: foreach ($activity as $item): ?><a href="<?= h((string) $item['url']) ?>"><span class="activity-kind"><?= h((string) $item['kind']) ?></span><strong><?= h((string) $item['label']) ?></strong><small><?= h(community_relative_time((string) $item['created_at'])) ?></small></a><?php endforeach; endif; ?></div></section>
  </div>
</article>
