from pathlib import Path
p=Path('site/assets/layout.js');s=p.read_text(encoding='utf-8');s=s.replace("  let lastY = scrollY;", "  let lastY = scrollY;\n  shell.classList.toggle('scrolled', scrollY > 10);");p.write_text(s,encoding='utf-8')
