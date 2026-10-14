import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Unmodified Amiri 1.003, SIL Open Font License 1.1.
// Upstream: https://github.com/aliftype/amiri/releases/tag/1.003
// Archive: https://github.com/aliftype/amiri/releases/download/1.003/Amiri-1.003.zip
// Archive SHA-256: 81af0aff7d2086d8af24cea7202f7546130997982534691373485cd96744d05e
// Font SHA-256: cd2550c0f4c05eb341bf97958211aaa39382bca96577ba3a67d4a3b4912c43c0
// License: https://github.com/aliftype/amiri/blob/1.003/OFL.txt
// Only the authored RTL field is pinned; Latin/CJK still use the host fonts.
// Append to fixture.themeCss BEFORE scenario construction/export, and await
// document.fonts.ready after layout. Keep 12px type; 24px RTL lines contain Amiri's 21px font box.
export async function specialPaperFontCss() {
  const [font, license] = await Promise.all([
    readFile(path.resolve(process.cwd(), 'e2e/fonts/Amiri-Regular.ttf')),
    readFile(path.resolve(process.cwd(), 'e2e/fonts/OFL-Amiri.txt'), 'utf8')
  ]);
  // Retain the license in exported offline HTML, not just beside the asset.
  return `/* ${license} */
@font-face {
  font-family: "Special Paper Arabic";
  src: url("data:font/ttf;base64,${font.toString('base64')}") format("truetype");
  font-style: normal;
  font-weight: 400;
}
[data-paper-field="rtl"] { font-family: "Special Paper Arabic"; line-height:24px; }
`;
}
