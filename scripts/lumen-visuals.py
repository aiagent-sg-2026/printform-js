#!/usr/bin/env python3
"""Rasterize the real Chromium PDFs and assemble local visual-QA contact sheets."""
import pathlib, subprocess, math
from PIL import Image, ImageDraw
root = pathlib.Path(__file__).resolve().parent.parent
out = root.parent / 'artifacts/lumen'
for name in ['default', 'small', 'stress', 'long', 'metadata', 'missing', 'zero', 'all-missing']:
    folder = out / ('raster-' + name)
    folder.mkdir(exist_ok=True)
    subprocess.run(['pdftoppm', '-scale-to', '700', '-png', str(out / (name + '.pdf')), str(folder / 'page')], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    files = sorted(folder.glob('page-*.png'))
    sheet = Image.new('RGB', (430 * 3, 625 * math.ceil(len(files) / 3)), '#dfe6df')
    for index, file in enumerate(files):
        image = Image.open(file)
        image.thumbnail((420, 594))
        x, y = (index % 3) * 430, (index // 3) * 625
        sheet.paste(image, (x + 5, y + 5))
        ImageDraw.Draw(sheet).text((x + 10, y + 603), f'{name} / Page {index + 1} of {len(files)}', fill='#223c33')
    sheet.save(out / (name + '-contact.png'))
image = Image.open(out / 'thumbnail.png')
image.resize((400, round(image.height * 400 / image.width))).save(root / 'gallery/thumbs/lumen-learning-progress-portfolio.png', optimize=True)
print('PDF rasters/contact sheets generated; thumbnail derived from actual default render')
