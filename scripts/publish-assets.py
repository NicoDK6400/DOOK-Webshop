"""Fingerprint authored static assets and point the entrypoint at this revision."""
from pathlib import Path
import hashlib,re
root=Path(__file__).resolve().parents[1]/'public'
page=(root/'index.html').read_text()
for name in ['catalog.js','lenses.js','app.js','b2b.js','trade-catalog.js','shop.js','news.js','manage.js','style.css']:
 data=(root/name).read_bytes();stem,suffix=name.split('.')
 version=f'{stem}.{hashlib.sha256(data).hexdigest()[:12]}.{suffix}'
 (root/version).write_bytes(data)
 if name=='lenses.js' and not re.search(r'/lenses[.\w-]*\.js',page):
  page=page.replace('<script src="/app.',f'<script src="/{version}"></script><script src="/app.')
 else:
  page=re.sub(r'/'+stem+r'(?:\.[\w-]+)?\.'+suffix, '/'+version,page)
(root/'index.html').write_text(page)
