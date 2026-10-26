#!/usr/bin/env python3
"""Builds the Marinara personal extension (기억 서재 · 기억 모듈판) into ../deliverable/."""
from pathlib import Path
import json, re, zipfile

root = Path(__file__).resolve().parent
out = root.parent / 'deliverable'
out.mkdir(exist_ok=True)
version = re.search(r"const VERSION = '([^']+)'", (root.parent / 'memory-module' / 'marinara-memory-runtime.cjs').read_text()).group(1)
manifest = {
    "kind": "marinara.personal-extension",
    "version": 1,
    "config": {
        "name": "기억 서재",
        "version": version,
        "description": "장기 기억 모듈(비공식)의 화면입니다. 장면·챕터·알게 된 사실·아직 끝나지 않은 일·최근 생활을 보고 고치고, 정리와 회상을 설정합니다. 기억은 서버의 기억 모듈에 있습니다. 기억 모듈을 먼저 설치해 주세요.",
        "runtime": "client",
        "enabled": False,
        "capabilities": ["full_page_access"],
        "jsPath": "extension.js",
        "cssPath": "extension.css",
    },
}
js = (root / 'runtime.js').read_text()
js = js.replace("/*__UI_CSS__*/ ''", "/*__UI_CSS__*/ " + json.dumps((root / 'ui.css').read_text(), ensure_ascii=False))
js = js.replace("/*__THEME_CSS__*/ ''", "/*__THEME_CSS__*/ " + json.dumps((root / 'theme.css').read_text(), ensure_ascii=False))
js = js.replace("'/*__VERSION__*/'", json.dumps(version))
(out / 'extension.js').write_text('/* 기억 서재 · 마리나라 엔진용 기억 모듈 (비공식) */\n' + js)
(out / 'extension.css').write_text('/* UI styles live in an isolated ShadowRoot. */\n')
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
name = out / 'memory-library-module.personal-extension.zip'
with zipfile.ZipFile(name, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in ['manifest.json', 'extension.js', 'extension.css']:
        z.write(out / f, f)
print(name)
