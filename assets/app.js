(() => {
  const root = document.documentElement;
  const stored = localStorage.getItem('secretary-status-theme');
  if (stored === 'light' || stored === 'dark') root.dataset.theme = stored;

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'light' ? 'dark' : 'light';
      root.dataset.theme = next;
      localStorage.setItem('secretary-status-theme', next);
      window.requestAnimationFrame(() => drawResponseCharts());
    });
  });

  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      const confirmation = form.dataset.confirm;
      if (confirmation && !window.confirm(confirmation)) {
        event.preventDefault();
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      if (!submit) return;
      submit.disabled = true;
      submit.dataset.originalText = submit.textContent;
      submit.textContent = 'Working…';
    });
  });

  const uptimeTooltip = document.createElement('div');
  uptimeTooltip.className = 'uptime-tooltip';
  uptimeTooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(uptimeTooltip);

  const responseTooltip = document.createElement('div');
  responseTooltip.className = 'response-tooltip';
  responseTooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(responseTooltip);

  const placeTooltip = (element, event, gap = 14) => {
    const padding = 10;
    const box = element.getBoundingClientRect();
    let left = event.clientX - box.width / 2;
    let top = event.clientY - box.height - gap;
    left = Math.max(padding, Math.min(left, window.innerWidth - box.width - padding));
    if (top < padding) top = event.clientY + gap;
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  };

  let activeHistoryDay = null;
  document.addEventListener('pointerover', (event) => {
    const day = event.target.closest?.('.history-day[data-tooltip]');
    if (!day) return;
    activeHistoryDay = day;
    uptimeTooltip.textContent = day.dataset.tooltip;
    uptimeTooltip.classList.add('visible');
    placeTooltip(uptimeTooltip, event);
  });

  document.addEventListener('pointermove', (event) => {
    if (activeHistoryDay) placeTooltip(uptimeTooltip, event);
  });

  document.addEventListener('pointerout', (event) => {
    if (!activeHistoryDay || event.relatedTarget === activeHistoryDay) return;
    if (event.target.closest?.('.history-day[data-tooltip]') !== activeHistoryDay) return;
    activeHistoryDay = null;
    uptimeTooltip.classList.remove('visible');
  });

  const parseSeries = (card) => {
    try {
      const parsed = JSON.parse(card.dataset.series || '[]');
      return Array.isArray(parsed)
        ? parsed.filter((point) => Number.isFinite(Number(point.responseMs)) && point.checkedAt)
        : [];
    } catch {
      return [];
    }
  };

  const drawResponseChart = (card) => {
    const canvas = card.querySelector('[data-response-canvas]');
    if (!canvas) return;
    const hoverDot = card.querySelector('[data-response-hover-dot]');
    hoverDot?.classList.remove('visible', 'failed');
    const series = parseSeries(card);
    const empty = card.querySelector('.chart-empty');
    if (empty) empty.classList.toggle('is-hidden', series.length > 0);
    if (!series.length) {
      canvas.width = 1;
      canvas.height = 1;
      canvas._responsePoints = [];
      return;
    }

    const width = Math.max(300, Math.floor(canvas.clientWidth || canvas.parentElement.clientWidth));
    const height = Math.max(220, Math.floor(canvas.clientHeight || 255));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);

    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const styles = getComputedStyle(root);
    const green = styles.getPropertyValue('--green').trim() || '#23d989';
    const red = styles.getPropertyValue('--red').trim() || '#ff6c7b';
    const line = styles.getPropertyValue('--line').trim() || '#173044';
    const muted = styles.getPropertyValue('--muted').trim() || '#78909c';
    const padding = { top: 16, right: 16, bottom: 28, left: 54 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const maximum = Math.max(...series.map((point) => Number(point.responseMs)), 1);
    const axisMaximum = Math.max(100, Math.ceil((maximum * 1.12) / 100) * 100);

    context.lineWidth = 1;
    context.font = '10px Inter, system-ui, sans-serif';
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    for (let step = 0; step <= 4; step += 1) {
      const value = (axisMaximum / 4) * step;
      const y = padding.top + plotHeight - (value / axisMaximum) * plotHeight;
      context.strokeStyle = line;
      context.globalAlpha = 0.7;
      context.beginPath();
      context.moveTo(padding.left, y);
      context.lineTo(width - padding.right, y);
      context.stroke();
      context.globalAlpha = 1;
      context.fillStyle = muted;
      context.fillText(`${Math.round(value)}ms`, padding.left - 8, y);
    }

    const points = series.map((point, index) => {
      const x = series.length === 1
        ? padding.left + plotWidth / 2
        : padding.left + (index / (series.length - 1)) * plotWidth;
      const y = padding.top + plotHeight - (Number(point.responseMs) / axisMaximum) * plotHeight;
      return { ...point, x, y, responseMs: Number(point.responseMs) };
    });

    const area = context.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
    area.addColorStop(0, `${green}45`);
    area.addColorStop(1, `${green}00`);
    context.beginPath();
    context.moveTo(points[0].x, padding.top + plotHeight);
    points.forEach((point) => context.lineTo(point.x, point.y));
    context.lineTo(points[points.length - 1].x, padding.top + plotHeight);
    context.closePath();
    context.fillStyle = area;
    context.fill();

    context.beginPath();
    points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
    context.strokeStyle = green;
    context.lineWidth = 2;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke();

    points.filter((point) => !point.up).forEach((point) => {
      context.beginPath();
      context.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      context.fillStyle = red;
      context.fill();
    });

    const formatAxisTime = (value) => new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(new Date(value));
    context.fillStyle = muted;
    context.font = '10px Inter, system-ui, sans-serif';
    context.textBaseline = 'bottom';
    context.textAlign = 'left';
    context.fillText(formatAxisTime(points[0].checkedAt), padding.left, height - 2);
    context.textAlign = 'right';
    context.fillText(formatAxisTime(points[points.length - 1].checkedAt), width - padding.right, height - 2);
    canvas._responsePoints = points;
  };

  const drawResponseCharts = (scope = document) => {
    scope.querySelectorAll?.('[data-response-chart]').forEach(drawResponseChart);
  };

  let activeCanvas = null;
  document.addEventListener('pointermove', (event) => {
    const canvas = event.target.closest?.('[data-response-canvas]');
    if (!canvas || !canvas._responsePoints?.length) return;
    activeCanvas = canvas;
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const nearest = canvas._responsePoints.reduce((best, point) =>
      Math.abs(point.x - localX) < Math.abs(best.x - localX) ? point : best
    );
    const timestamp = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium', timeStyle: 'short'
    }).format(new Date(nearest.checkedAt));
    const hoverDot = canvas.parentElement.querySelector('[data-response-hover-dot]');
    if (hoverDot) {
      hoverDot.style.left = `${nearest.x}px`;
      hoverDot.style.top = `${nearest.y}px`;
      hoverDot.classList.toggle('failed', !nearest.up);
      hoverDot.classList.add('visible');
    }
    const timeLine = document.createElement('span');
    timeLine.textContent = timestamp;
    const valueLine = document.createElement('strong');
    valueLine.textContent = `${Math.round(nearest.responseMs)}ms${nearest.up ? '' : ' · failed check'}`;
    responseTooltip.replaceChildren(timeLine, valueLine);
    responseTooltip.classList.add('visible');
    placeTooltip(responseTooltip, event, 18);
  });

  document.addEventListener('pointerout', (event) => {
    if (!activeCanvas || event.target !== activeCanvas) return;
    activeCanvas.parentElement.querySelector('[data-response-hover-dot]')?.classList.remove('visible', 'failed');
    activeCanvas = null;
    responseTooltip.classList.remove('visible');
  });

  drawResponseCharts();
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => drawResponseCharts(), 120);
  });

  const region = document.querySelector('[data-live-status]');
  if (!region) return;

  const DEFAULT_CHECK_INTERVAL_MS = 300000;
  const STALE_RETRY_MS = 15000;
  const endpoint = region.dataset.endpoint || '/live-status';
  let polling = false;
  let lastUpdatedAt = Date.now();
  let lastCheckAt = null;
  let checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS;
  let nextPollAt = Date.now() + checkIntervalMs;
  let waitingForFreshStats = false;
  let refreshAttempt = 0;

  const parseDiagnostic = (content) => {
    try {
      return JSON.parse(content?.dataset.diagnostic || '{}');
    } catch (error) {
      return { diagnosticParseError: error.message };
    }
  };

  const statusContext = (content, extra = {}) => ({
    endpoint,
    page: window.location.href,
    online: navigator.onLine,
    visibility: document.visibilityState,
    feedState: content?.dataset.feedState || 'unknown',
    backendError: content?.dataset.backendError || '',
    backend: parseDiagnostic(content),
    ...extra,
  });

  const reportStatusProblem = (message, context, error = null) => {
    console.groupCollapsed(`[The Secretary Status] ${message}`);
    console.error(message, context);
    if (error) console.error(error);
    console.info('Copy this diagnostic object when reporting the issue:', context);
    console.groupEnd();
  };

  const syncScheduleFromStatus = (previousCheckAt = null) => {
    const content = region.querySelector('[data-status-content]');
    const intervalMinutes = Number(content?.dataset.checkIntervalMinutes || 5);
    checkIntervalMs = Number.isFinite(intervalMinutes) && intervalMinutes > 0
      ? intervalMinutes * 60000
      : DEFAULT_CHECK_INTERVAL_MS;

    const parsedCheckAt = Date.parse(content?.dataset.lastCheckAt || '');
    if (!Number.isFinite(parsedCheckAt)) {
      lastCheckAt = null;
      nextPollAt = Date.now() + checkIntervalMs;
      waitingForFreshStats = false;
      return;
    }

    lastCheckAt = parsedCheckAt;
    lastUpdatedAt = parsedCheckAt;
    const scheduledAt = parsedCheckAt + checkIntervalMs;
    if (scheduledAt > Date.now()) {
      nextPollAt = scheduledAt;
      waitingForFreshStats = false;
      return;
    }

    const receivedNewCheck = previousCheckAt !== null && parsedCheckAt > previousCheckAt;
    nextPollAt = receivedNewCheck
      ? Math.max(scheduledAt, Date.now() + STALE_RETRY_MS)
      : (previousCheckAt === null ? Date.now() : Date.now() + STALE_RETRY_MS);
    waitingForFreshStats = true;
  };

  const formatClockTime = (value) => new Intl.DateTimeFormat(undefined, {
    hour: 'numeric', minute: '2-digit', second: '2-digit'
  }).format(new Date(value));

  const renderRefreshClock = () => {
    const updated = region.querySelector('[data-live-last-updated]');
    const countdown = region.querySelector('[data-live-countdown-line]');
    if (updated) {
      updated.dateTime = new Date(lastUpdatedAt).toISOString();
      updated.textContent = formatClockTime(lastUpdatedAt);
    }
    if (countdown) {
      if (polling) {
        countdown.textContent = 'Updating now…';
      } else {
        const seconds = Math.max(0, Math.ceil((nextPollAt - Date.now()) / 1000));
        countdown.textContent = waitingForFreshStats
          ? `Syncing latest stats in ${seconds} sec.`
          : `Next update in ${seconds} sec.`;
      }
    }
  };

  const refreshStatus = async () => {
    if (polling || document.visibilityState !== 'visible') return;
    refreshAttempt += 1;
    const attempt = refreshAttempt;
    const requestStartedAt = performance.now();
    const previousCheckAt = lastCheckAt;
    polling = true;
    nextPollAt = Number.POSITIVE_INFINITY;
    region.setAttribute('aria-busy', 'true');
    renderRefreshClock();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'TheSecretaryStatus' },
        signal: controller.signal,
      });

      const template = document.createElement('template');
      const responseText = await response.text();
      template.innerHTML = responseText.trim();
      const nextContent = template.content.querySelector('[data-status-content]');
      const feedState = response.headers.get('X-The-Secretary-Status-Feed')
        || nextContent?.dataset.feedState
        || 'unknown';
      const context = statusContext(nextContent, {
        attempt,
        durationMs: Math.round(performance.now() - requestStartedAt),
        httpStatus: response.status,
        httpStatusText: response.statusText,
        responseType: response.headers.get('Content-Type') || '',
        responseBytes: new Blob([responseText]).size,
        feedState,
      });
      if (!response.ok || feedState === 'unavailable') {
        const error = new Error(context.backendError || `Live status endpoint returned HTTP ${response.status} (${feedState}).`);
        error.statusContext = context;
        throw error;
      }
      if (!nextContent) {
        const error = new Error('Live status endpoint returned incomplete markup.');
        error.statusContext = {
          ...context,
          responsePreview: responseText.replace(/\s+/g, ' ').slice(0, 300),
        };
        throw error;
      }
      if (feedState === 'cached') {
        console.warn('[The Secretary Status] Refresh returned a cached monitor snapshot.', context);
      }

      activeHistoryDay = null;
      activeCanvas = null;
      uptimeTooltip.classList.remove('visible');
      responseTooltip.classList.remove('visible');
      region.replaceChildren(nextContent);
      drawResponseCharts(region);
      region.dataset.liveState = 'connected';
      syncScheduleFromStatus(previousCheckAt);
    } catch (error) {
      const context = error.statusContext || statusContext(region.querySelector('[data-status-content]'), {
        attempt,
        durationMs: Math.round(performance.now() - requestStartedAt),
        failure: error.name === 'AbortError' ? 'timeout' : 'network-or-browser',
      });
      reportStatusProblem(
        error.name === 'AbortError'
          ? 'Live status request timed out after 20 seconds.'
          : `Live status refresh failed: ${error.message}`,
        context,
        error
      );
      region.dataset.liveState = 'retrying';
      nextPollAt = Date.now() + STALE_RETRY_MS;
      waitingForFreshStats = true;
    } finally {
      window.clearTimeout(timeout);
      region.setAttribute('aria-busy', 'false');
      polling = false;
      if (!Number.isFinite(nextPollAt)) {
        nextPollAt = Date.now() + STALE_RETRY_MS;
        waitingForFreshStats = true;
      }
      renderRefreshClock();
    }
  };

  syncScheduleFromStatus();
  const initialContent = region.querySelector('[data-status-content]');
  const initialFeedState = initialContent?.dataset.feedState || 'unknown';
  if (initialFeedState === 'unavailable') {
    reportStatusProblem(
      'The page loaded without a live monitor feed.',
      statusContext(initialContent, { phase: 'initial-page-render' })
    );
    nextPollAt = Date.now();
    waitingForFreshStats = true;
    window.setTimeout(() => refreshStatus(), 0);
  } else if (initialFeedState === 'cached') {
    console.warn('[The Secretary Status] The page is using a cached monitor snapshot.', statusContext(initialContent));
  }
  renderRefreshClock();
  window.setInterval(() => {
    renderRefreshClock();
    if (!polling && document.visibilityState === 'visible' && Date.now() >= nextPollAt) refreshStatus();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      renderRefreshClock();
      if (Date.now() >= nextPollAt) refreshStatus();
    }
  });
})();

(() => {
  const accountMenu = document.querySelector('[data-account-menu]');
  const accountToggle = document.querySelector('[data-account-menu-toggle]');
  const profileDialog = document.querySelector('[data-profile-dialog]');
  const profileContent = profileDialog?.querySelector('[data-profile-content]');
  const editorDialog = document.querySelector('[data-profile-edit-dialog]');
  const topicDialog = document.querySelector('[data-topic-dialog]');
  const communityToast = document.querySelector('[data-community-toast]');
  if (communityToast) window.setTimeout(() => communityToast.remove(), 6000);

  const closeAccountMenu = () => {
    if (!accountMenu) return;
    accountMenu.hidden = true;
    accountToggle?.setAttribute('aria-expanded', 'false');
  };

  const openProfile = async (username) => {
    if (!profileDialog || !profileContent || !username) return;
    closeAccountMenu();
    profileContent.innerHTML = '<div class="profile-loading">Loading profile…</div>';
    if (!profileDialog.open) profileDialog.showModal();
    try {
      const response = await fetch(`/profile-card?user=${encodeURIComponent(username)}`, {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'TheSecretaryCommunity' },
      });
      const html = await response.text();
      profileContent.innerHTML = html;
      if (!response.ok) profileContent.querySelector('.profile-not-found')?.focus?.();
    } catch {
      profileContent.innerHTML = '<div class="profile-not-found"><h2>Profile unavailable</h2><p>Try again in a moment.</p></div>';
    }
  };

  accountToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!accountMenu) return;
    accountMenu.hidden = !accountMenu.hidden;
    accountToggle.setAttribute('aria-expanded', String(!accountMenu.hidden));
  });

  document.addEventListener('click', (event) => {
    if (accountMenu && !accountMenu.hidden && !event.target.closest('[data-account-menu]') && !event.target.closest('[data-account-menu-toggle]')) closeAccountMenu();
    const profileTrigger = event.target.closest('[data-profile-user]');
    if (profileTrigger) {
      event.preventDefault();
      openProfile(profileTrigger.dataset.profileUser);
      return;
    }
    if (event.target.closest('[data-close-profile]')) profileDialog?.close();
    if (event.target.closest('[data-edit-profile]')) {
      profileDialog?.close();
      closeAccountMenu();
      if (editorDialog && !editorDialog.open) editorDialog.showModal();
    }
    if (event.target.closest('[data-close-profile-editor]')) editorDialog?.close();
    if (event.target.closest('[data-open-topic]') && topicDialog && !topicDialog.open) topicDialog.showModal();
    if (event.target.closest('[data-close-topic]')) topicDialog?.close();
    const replyButton = event.target.closest('[data-reply-to]');
    if (replyButton) {
      const composer = document.querySelector('.reply-composer');
      const parent = composer?.querySelector('[data-parent-reply]');
      const notice = composer?.querySelector('[data-replying-to]');
      if (composer && parent && notice) {
        parent.value = replyButton.dataset.replyTo || '0';
        notice.hidden = parent.value === '0';
        const name = notice.querySelector('strong');
        if (name) name.textContent = replyButton.dataset.replyName || '';
        composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        composer.querySelector('[data-reply-body]')?.focus();
      }
    }
    if (event.target.closest('[data-clear-reply]')) {
      const composer = document.querySelector('.reply-composer');
      if (composer) {
        const parent = composer.querySelector('[data-parent-reply]');
        const notice = composer.querySelector('[data-replying-to]');
        if (parent) parent.value = '0';
        if (notice) notice.hidden = true;
      }
    }
  });

  [profileDialog, editorDialog, topicDialog].forEach((dialog) => dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  }));

  if (editorDialog) {
    const preview = editorDialog.querySelector('[data-profile-preview]');
    const nameInput = editorDialog.querySelector('[data-profile-name-input]');
    const bioInput = editorDialog.querySelector('[data-profile-bio-input]');
    const effectInput = editorDialog.querySelector('[data-profile-effect]');
    const primaryInput = editorDialog.querySelector('[data-primary-color]');
    const secondaryInput = editorDialog.querySelector('[data-secondary-color]');
    const previewName = editorDialog.querySelector('[data-profile-name]');
    const previewBio = editorDialog.querySelector('[data-profile-bio]');
    const previewBanner = editorDialog.querySelector('[data-profile-banner]');
    const previewAvatar = editorDialog.querySelector('.profile-live-preview .user-avatar img');
    const previewFile = (input, target, background = false) => input?.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (background) target.style.backgroundImage = `url("${reader.result}")`;
        else target.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    nameInput?.addEventListener('input', () => { if (previewName) previewName.textContent = nameInput.value || 'Your name'; });
    bioInput?.addEventListener('input', () => { if (previewBio) previewBio.textContent = bioInput.value || 'No bio yet.'; });
    primaryInput?.addEventListener('input', () => preview?.style.setProperty('--profile-primary', primaryInput.value));
    secondaryInput?.addEventListener('input', () => preview?.style.setProperty('--profile-secondary', secondaryInput.value));
    effectInput?.addEventListener('change', () => {
      if (!preview) return;
      [...preview.classList].filter((name) => name.startsWith('effect-')).forEach((name) => preview.classList.remove(name));
      preview.classList.add(`effect-${effectInput.value}`);
    });
    previewFile(editorDialog.querySelector('[data-avatar-input]'), previewAvatar);
    previewFile(editorDialog.querySelector('[data-banner-input]'), previewBanner, true);
    editorDialog.querySelectorAll('input[type="range"]').forEach((range) => range.addEventListener('input', () => {
      if (!preview) return;
      const mappings = { avatar_scale: '--avatar-scale', avatar_x: '--avatar-x', avatar_y: '--avatar-y', banner_y: '--banner-y' };
      const unit = range.name === 'avatar_scale' ? '' : '%';
      preview.style.setProperty(mappings[range.name], `${range.value}${unit}`);
      if (range.name.startsWith('avatar_')) preview.querySelector('.user-avatar')?.style.setProperty(mappings[range.name], `${range.value}${unit}`);
      if (range.name === 'banner_y' && previewBanner) previewBanner.style.backgroundPosition = `center ${range.value}%`;
    }));
  }
})();

(() => {
  const subscribeDialog = document.querySelector('[data-subscribe-dialog]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const footerMenus = [...document.querySelectorAll('.footer-menu')];
  const footerBreakpoint = window.matchMedia('(max-width: 620px)');
  const syncFooterMenus = (mobile) => footerMenus.forEach((menu) => {
    if (mobile) menu.removeAttribute('open');
    else menu.setAttribute('open', '');
  });
  syncFooterMenus(footerBreakpoint.matches);
  footerBreakpoint.addEventListener?.('change', (event) => syncFooterMenus(event.matches));

  document.addEventListener('click', (event) => {
    const openSubscribe = event.target.closest('[data-open-subscribe]');
    const closeSubscribe = event.target.closest('[data-close-subscribe]');
    const mobileToggle = event.target.closest('[data-mobile-nav]');
    if (openSubscribe && subscribeDialog) subscribeDialog.showModal();
    if (closeSubscribe && subscribeDialog) subscribeDialog.close();
    if (mobileToggle && mobileMenu) {
      const next = !mobileMenu.hidden;
      mobileMenu.hidden = next;
      mobileToggle.setAttribute('aria-expanded', String(!next));
    }
  });

  if (subscribeDialog) {
    subscribeDialog.addEventListener('click', (event) => {
      if (event.target === subscribeDialog) subscribeDialog.close();
    });
  }

  const subscription = new URLSearchParams(window.location.search).get('subscription');
  if (subscription) {
    const toast = document.createElement('div');
    toast.className = `toast ${subscription === 'success' ? 'success' : 'error'}`;
    toast.textContent = subscription === 'success'
      ? 'Subscribed. Status alerts will arrive by email.'
      : subscription === 'invalid'
        ? 'Enter a valid email and accept the notification consent.'
        : 'Subscription could not be completed. Please try again.';
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 6000);
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  }

  const slugify = (value) => value.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

  document.querySelectorAll('[data-editor-form]').forEach((form) => {
    const editor = form.querySelector('[data-rich-editor]');
    const output = form.querySelector('[data-rich-output]');
    const title = form.querySelector('[data-slug-title]');
    const slug = form.querySelector('[data-slug-input]');
    if (editor && output) {
      const sync = () => { output.value = editor.innerHTML.trim(); };
      editor.addEventListener('input', sync);
      form.addEventListener('submit', sync);
      form.querySelectorAll('[data-editor-command]').forEach((button) => {
        button.addEventListener('click', () => {
          editor.focus();
          document.execCommand(button.dataset.editorCommand, false, button.dataset.editorValue || null);
          sync();
        });
      });
      const linkButton = form.querySelector('[data-editor-link]');
      if (linkButton) linkButton.addEventListener('click', () => {
        const href = window.prompt('Paste an HTTPS link');
        if (href && /^https:\/\//i.test(href)) {
          editor.focus();
          document.execCommand('createLink', false, href);
          sync();
        }
      });
    }
    if (title && slug) {
      let manuallyEdited = slug.value.trim() !== '';
      slug.addEventListener('input', () => { manuallyEdited = slug.value.trim() !== ''; });
      title.addEventListener('input', () => { if (!manuallyEdited) slug.value = slugify(title.value); });
    }
  });
})();
