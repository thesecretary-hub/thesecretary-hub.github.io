from pathlib import Path
root=Path(r'C:\Users\diksh\source\repos\thesecretary-hub.github.io')
a=root/'site/assets'
p=a/'status.js';s=p.read_text(encoding='utf-8');s=s.replace("const root =", "const mobileHistory = matchMedia('(max-width: 700px)');\nconst historyDays = () => mobileHistory.matches ? 30 : 90;\nlet refreshHistory = () => {};\nmobileHistory.addEventListener('change', () => refreshHistory());\n\nconst root =",1)
s=s.replace('Array.from({length: 90}', 'Array.from({length: historyDays()}').replace('statusDateAtOffset(89 - index)','statusDateAtOffset(historyDays() - 1 - index)').replace('index === 89','index === historyDays() - 1').replace('aria-label="90-day status history"','aria-label="${historyDays()}-day status history"').replace('<span>90 days ago</span>','<span>${historyDays()} days</span>').replace('service.uptime === null || service.uptime === undefined', 'uptime === null || uptime === undefined').replace('Number(service.uptime)', 'Number(uptime)').replace("'No outages recorded'", "'Uptime unavailable'")
s=s.replace("  const detail = service.offlineUntil", "  const uptime = service.kind === 'website' ? monitor.uptime?.[String(historyDays())] : service.uptime;\n  const detail = service.offlineUntil")
s=s.replace('Uptime over the past 90 days.', 'Uptime over the past ${historyDays()} days.')
s=s.replace("  const tooltip = root.querySelector('[data-status-tooltip]');", "  refreshHistory = () => {\n    root.querySelector('.uptime-caption').textContent = `Uptime over the past ${historyDays()} days.`;\n    root.querySelector('.service-list').innerHTML = services.map(service => serviceRow(service, monitor, data.historyEvents || [])).join('');\n    root.querySelector('[data-status-tooltip]').classList.remove('visible');\n  };\n  const tooltip = root.querySelector('[data-status-tooltip]');")
p.write_text(s,encoding='utf-8')
p=a/'hub.js';s=p.read_text(encoding='utf-8');s=s.replace("  const syncShowcaseVideo = () => {", "  const simpleMotion = matchMedia('(max-width: 960px), (prefers-reduced-motion: reduce)');\n  const syncShowcaseVideo = () => {") .replace('showcaseVisible && !manuallyPaused','!simpleMotion.matches && showcaseVisible && !manuallyPaused')
s=s.replace("  video.addEventListener('canplay'", "  const syncMedia = () => {\n    [video, document.querySelector('[data-scroll-story-video]')].forEach(media => {\n      const source = media.querySelector('source');\n      if (simpleMotion.matches) {\n        media.pause();\n        if (source.hasAttribute('src')) { source.dataset.src = source.getAttribute('src'); source.removeAttribute('src'); media.load(); }\n      } else if (!source.hasAttribute('src')) { source.src = source.dataset.src; media.load(); }\n    });\n    syncShowcaseVideo();\n  };\n  simpleMotion.addEventListener('change', syncMedia);\n  syncMedia();\n  video.addEventListener('canplay'")
s=s.replace('    storyFrame = 0;','    storyFrame = 0;\n    if (simpleMotion.matches) return;')
s=s.replace('if (!storyFrame) storyFrame', 'if (!simpleMotion.matches && !storyFrame) storyFrame')
p.write_text(s,encoding='utf-8')
p=root/'site/index.html';s=p.read_text(encoding='utf-8').replace('autoplay muted loop','preload="none" muted loop').replace('preload="metadata"','preload="none"').replace('<source src="/assets/media/', '<source data-src="/assets/media/');p.write_text(s,encoding='utf-8')
p=a/'layout.js';s=p.read_text(encoding='utf-8').replace("toggle.addEventListener('click', () => setDrawer(!drawerOpen));", "toggle.addEventListener('click', () => {\n    if (matchMedia('(max-width: 960px)').matches) { location.href = '/posts/'; return; }\n    setDrawer(!drawerOpen);\n  });")
s=s.replace("if (event.key === 'Escape') setDrawer(false);", "if (event.key === 'Escape') { setDrawer(false); shell.classList.remove('mobile-open'); document.querySelector('[data-hub-menu]')?.setAttribute('aria-expanded', 'false'); }")
s=s.replace('if (!drawerOpen && y > 110', "if (!drawerOpen && !shell.classList.contains('mobile-open') && y > 110")
p.write_text(s,encoding='utf-8')
# Load responsive overrides on every route, including error and authentication pages.
for p in (root/'site').rglob('*.html'):
 s=p.read_text(encoding='utf-8');s=s.replace('</head>', '  <link rel="stylesheet" href="/assets/mobile.css?v=1">\n</head>');p.write_text(s,encoding='utf-8')
