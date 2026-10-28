"""Optional font regeneration: fonttools + brotli; reads locally licensed Noto fonts.
No network is used. Checked-in WOFF2 files make ordinary JS builds independent of Python.
"""
from pathlib import Path
from argparse import ArgumentParser
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

root = Path(__file__).resolve().parents[1]
parser = ArgumentParser()
parser.add_argument('--output', type=Path, default=root / 'gallery/designs/assets/fonts/aster-v1')
target = parser.parse_args().output
target.mkdir(parents=True, exist_ok=True)
for weight in ['Regular', 'Bold']:
    font = TTFont(f'/usr/share/fonts/truetype/noto/NotoSans-{weight}.ttf')
    subset = Subsetter(options=Options())
    subset.populate(unicodes=list(range(0x20, 0x250)) + [0x2013, 0x2014, 0x2019, 0x2022, 0x2192, 0x2212, 0x25B3, 0x2713])
    subset.subset(font)
    for key, value in [(1, 'Aster Sans'), (4, f'Aster Sans {weight}'), (6, f'AsterSans-{weight}'), (16, 'Aster Sans'), (17, weight)]:
        font['name'].setName(value, key, 3, 1, 0x409)
    # Preserve the approved derivative's head timestamp, not wall-clock time.
    font.recalcTimestamp = False
    font['head'].modified = 3876032048
    font.flavor = 'woff2'
    font.save(target / f'NotoSans-{weight}.woff2')
font = TTFont('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', fontNumber=2)
# Preserve the full unified CJK repertoire. Remove lower-codepoint radical
# aliases for identical glyphs: Chromium otherwise emits those aliases in the
# PDF ToUnicode map (e.g. U+2F42 instead of the source character 文 U+6587).
# This is a font-local authoring correction, not text rewriting or engine code.
for table in font['cmap'].tables:
    if table.isUnicode() and hasattr(table, 'cmap'):
        unified = {glyph for code, glyph in table.cmap.items() if 0x3400 <= code <= 0x9FFF}
        for code in list(table.cmap):
            if 0x2E80 <= code <= 0x2FFF and table.cmap[code] in unified:
                del table.cmap[code]
for key, value in [(1, 'Aster CJK SC'), (4, 'Aster CJK SC Regular'), (6, 'AsterCJKSC-Regular'), (16, 'Aster CJK SC'), (17, 'Regular')]:
    font['name'].setName(value, key, 3, 1, 0x409)
font.recalcTimestamp = False
font['head'].modified = 3876032069
font.flavor = 'woff2'
font.save(target / 'NotoSansCJKsc-Regular.woff2')
notice = Path('/usr/share/doc/fonts-noto-cjk/copyright').read_text()
license_text = notice.split('License: SIL-1.1\n -----------------------------------------------------------', 1)[1].split('\nLicense: GPL-3+', 1)[0]
header = ('Noto Sans: Copyright 2010,2012-2020 Google Inc.; 2015-2020 Google LLC.\n'
          'Noto Sans CJK: Copyright 2010-2012 Google Corporation.\n'
          'Source: https://github.com/notofonts/noto-fonts and https://github.com/notofonts/noto-cjk\n'
          'Locally converted to WOFF2; Latin subsets and static CJK SC with unified CJK coverage.\n'
          'Modified Aster families; redundant radical cmap aliases removed for exact PDF extraction.\n'
          'All bundled fonts remain under SIL Open Font License 1.1.\n\n')
(target / 'FONT-LICENSE.txt').write_text(header + ' -----------------------------------------------------------' + license_text)
print('Generated two Latin subsets and a static unified-CJK SC face (OFL 1.1).')
