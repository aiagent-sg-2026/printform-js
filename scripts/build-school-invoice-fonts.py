"""Optional font regeneration: pip install fonttools brotli in a local venv.
Only public Google Fonts is fetched; normal builds use committed static subsets.
"""
import io
import json
import pathlib
import re
import urllib.parse
import urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'gallery/designs/assets/school-invoices'
chars = sorted(set(c for file in ASSETS.iterdir() if file.suffix in ('.js', '.json')
                   for c in file.read_text() if ord(c) > 127))
query = urllib.parse.urlencode({'family': 'Noto Sans SC:wght@100..900', 'text': ''.join(chars)})
url = 'https://fonts.googleapis.com/css2?' + query
agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'


def fetch(address):
    request = urllib.request.Request(address, headers={'User-Agent': agent})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


css = fetch(url).decode()
source_url = re.search(r'url\(([^)]+)\)', css).group(1)
source = fetch(source_url)
for weight, label in [(400, 'Regular'), (700, 'Bold')]:
    font = TTFont(io.BytesIO(source))
    font = instantiateVariableFont(font, {'wght': weight}, inplace=True)
    family = 'Demo School CJK'
    for key, value in [(1, family), (2, label), (3, f'{family}-{label}'),
                       (4, f'{family} {label}'), (6, f'DemoSchoolCJK-{label}'),
                       (16, family), (17, label)]:
        font['name'].setName(value, key, 3, 1, 0x409)
        font['name'].setName(value, key, 1, 0, 0)
    assert 'fvar' not in font
    assert all(ord(c) in font.getBestCmap() for c in chars)
    font.flavor = 'woff2'
    output = ASSETS / f'DemoSchoolCJK-{label}.woff2'
    font.save(output)
    print(f'{output.name}: {output.stat().st_size} bytes, {len(chars)} characters')
(ASSETS / 'cjk-glyphs.txt').write_text(''.join(chars) + '\n')
license_text = fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt').decode()
(ASSETS / 'FONT-LICENSE.txt').write_text('\n'.join(line.rstrip() for line in license_text.splitlines()) + '\n')
(ASSETS / 'FONT-PROVENANCE.md').write_text(
    '# CJK font\n\nNoto Sans SC by Adobe / Google; SIL Open Font License 1.1 '
    '(FONT-LICENSE.txt). Generated 2026-10-28 from the official Google Fonts subset API.\n\n'
    'FontTools instantiates static 400/700 weights and renames the modified fonts to '
    'Demo School CJK. Static fonts avoid Chromium variable-font Type 3 PDF output. '
    'The OFL Reserved Font Name Source is not used for the modified family. No system font installation.\n\n'
    'cjk-glyphs.txt contains all requested non-ASCII characters, including Chinese punctuation. '
    'Additional custom CJK input requires extending the subset. Latin text uses the existing '
    'licensed DejaVu fonts in ../demobank.\n\n'
    'Regenerate with scripts/build-school-invoice-fonts.py in a local venv with fonttools and brotli. '
    'Normal builds are offline and use the committed subsets.\n\n'
    f'Official CSS request: {url}\n\n'
    'Official source: https://github.com/google/fonts/tree/main/ofl/notosanssc\n')
