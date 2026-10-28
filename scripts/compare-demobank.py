"""Private sanitized-reference geometry/raster comparison; outputs never belong in git.
Usage: python3 scripts/compare-demobank.py ../input ../output
Requires Pillow and Poppler's pdftoppm. No proprietary fonts or original PDF needed.
"""
import json
import math
import subprocess
import sys
from collections import Counter
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

source = Path(sys.argv[1] if len(sys.argv) > 1 else '../input')
out = Path(sys.argv[2] if len(sys.argv) > 2 else '../output')
reference = json.loads((source / 'reference-geometry.json').read_text())
verification = json.loads((out / 'demobank-verification.json').read_text())
comparison = out / 'comparison'
comparison.mkdir(exist_ok=True)
for pdf, name in [(source / 'sanitized-layout-reference.pdf', 'reference'),
                  (out / 'demobank-statement.pdf', 'demobank')]:
    subprocess.run(['pdftoppm', '-r', '144', '-png', str(pdf), str(comparison / name)], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def horizontal_rules(image):
    pix = image.load()
    lines = []
    for y in range(image.height):
        runs, start = [], None
        for x in range(image.width):
            dark = pix[x, y] < 90
            if dark and start is None:
                start = x
            if not dark and start is not None:
                if x - start >= 130:
                    runs.append([start / 2, x / 2])
                start = None
        if runs and (not lines or lines[-1]['y'] < y / 2 - .6 or lines[-1]['runs'] != runs):
            lines.append({'y': y / 2, 'runs': runs})
    return lines


def gray_bands(image):
    bands = []
    for y in range(image.height):
        # A text-free strip just inside the left table/notice edge.
        gray = sum(180 < image.getpixel((x, y)) < 220 for x in range(90, 97)) >= 5
        if gray:
            if not bands or bands[-1][1] < y / 2 - .6:
                bands.append([y / 2, y / 2])
            else:
                bands[-1][1] = y / 2
    return bands


def draw_mask(draw, bbox, padding=1.5):
    x0, y0, x1, y1 = bbox
    draw.rectangle((math.floor((x0-padding)*2), math.floor((y0-padding)*2),
                    math.ceil((x1+padding)*2), math.ceil((y1+padding)*2)), fill=0)


results = []
for index, original in enumerate(reference):
    page = index + 1
    ref = Image.open(comparison / f'reference-{page}.png').convert('L')
    generated = Image.open(comparison / f'demobank-{page}.png').convert('L')
    target = Image.new('L', ref.size, 255)
    target.paste(generated, (0, 0))
    mask = Image.new('L', ref.size, 255)
    draw = ImageDraw.Draw(mask)
    for span in original['spans']:
        draw_mask(draw, span['bbox'], 2)
    for item in verification['pdf']['pages'][index]['items']:
        draw_mask(draw, [item['x'], item['y']-item['height'], item['x']+item['width'], item['y']+2], 2)
    for bbox in original['graphicExclusionBoxes']:
        draw_mask(draw, bbox, 2)
    # Original new artwork and visible footer disclaimer are not fidelity targets.
    if page <= 3:
        draw_mask(draw, [39, 13, 246, 51], 2)
    if page == 1:
        draw_mask(draw, [42.5, 433.92, 553, 632], 2)
    if page == 4:
        draw_mask(draw, [36, 424, 82, 470], 2)
    draw_mask(draw, [30, 812, 565, 842], 1)
    selected = mask.tobytes()
    a, b = ref.tobytes(), target.tobytes()
    union = [(x, y) for x, y, keep in zip(a, b, selected) if keep and (x < 245 or y < 245)]
    mae = sum(abs(x-y) for x, y in union) / max(1, len(union))
    different = sum(abs(x-y) > 40 for x, y in union) / max(1, len(union))
    masked_ref = Image.composite(ref, Image.new('L', ref.size, 255), mask)
    masked_target = Image.composite(target, Image.new('L', ref.size, 255), mask)
    # Red = reference structure; blue = generated structure; dark = both.
    overlay = Image.merge('RGB', (masked_target, ImageChops.darker(masked_ref, masked_target), masked_ref))
    overlay.save(comparison / f'geometry-overlay-{page}.png')
    mask.save(comparison / f'comparison-mask-{page}.png')
    pair = Image.new('RGB', (ref.width*2, ref.height), 'white')
    pair.paste(ref.convert('RGB'), (0, 0)); pair.paste(target.convert('RGB'), (ref.width, 0))
    pair.save(comparison / f'side-by-side-{page}.png')
    labels = []
    for span in original['spans']:
        if span.get('replaced') or span['text'].startswith('Page '):
            continue
        candidates = [t for t in verification['pdf']['pages'][index]['items']
                      if t['text'].strip() == span['text'].strip()]
        match = min(candidates, key=lambda t: (t['x']-span['origin'][0])**2
                    + (t['y']-span['origin'][1])**2) if candidates else None
        if match:
            labels.append({'label': span['text'], 'dxPt': round(match['x']-span['origin'][0], 3),
                           'baselineDyPt': round(match['y']-span['origin'][1], 3),
                           'referenceSizePt': span['size'], 'replacementSizePt': round(match['height'], 3)})
    before, after = horizontal_rules(ref), horizontal_rules(target)
    long_before = [r for r in before if any(z[1]-z[0] > 450 for z in r['runs'])]
    long_after = [r for r in after if any(z[1]-z[0] > 450 for z in r['runs'])]
    rule_deltas = [{'referenceY': r['y'], 'nearestGeneratedY': min(long_after, key=lambda n:abs(n['y']-r['y']))['y']}
                   for r in long_before] if long_after else []
    for r in rule_deltas:
        r['dyPt'] = round(r['nearestGeneratedY'] - r['referenceY'], 3)
    result = {'page': page, 'referencePagePt': [original['widthPt'], original['heightPt']],
              'generatedMediaBoxPt': [verification['pdf']['pages'][index]['width'], verification['pdf']['pages'][index]['height']],
              'referenceSpanCount': len(original['spans']),
              'referenceFonts': dict(Counter(s['font'] for s in original['spans'])),
              'referenceFontSizes': dict(Counter(s['size'] for s in original['spans'])),
              'referenceRules': before, 'generatedRules': after, 'nearestLongRuleDeltas': rule_deltas,
              'referenceGrayBands': [b for b in gray_bands(ref) if b[1]-b[0] > 3],
              'generatedGrayBands': [b for b in gray_bands(target) if b[1]-b[0] > 3],
              'genericLabelMetrics': labels, 'unmaskedForegroundUnionPixels': len(union),
              'foregroundMAE_0_255': round(mae, 3), 'foregroundDifferenceFractionAbove40': round(different, 5)}
    results.append(result)
    print(f'Page {page}: structural MAE {mae:.2f}, >40 difference {different:.1%}; {len(labels)} generic labels measured')
(out / 'demobank-comparison.json').write_text(json.dumps(results, indent=2))
