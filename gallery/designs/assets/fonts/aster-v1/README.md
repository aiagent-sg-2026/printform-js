# Shared Aster-derived OFL fonts · version 1

One shared font set for new Gallery templates. Existing templates are not retrofitted.
The `aster-v1` directory identifies the exact approved renamed derivatives, not an Aster-only copy.
A future template may reference these same files; do not copy them into its own asset directory.
Names/coverage/bytes are unchanged from Aster commit `6434b83`.

| File | Bytes | SHA-256 |
|---|---:|---|
| NotoSans-Regular.woff2 | 31512 | `97d815f50e8c21ba906b5f7fc8b7578f3b42b3e343b8fed49c13de29c67e697e` |
| NotoSans-Bold.woff2 | 31092 | `ed815795ac241cc631899cc16b737b1dcecc968a7179851af209ce8220ed1ef0` |
| NotoSansCJKsc-Regular.woff2 | 11425676 | `c251539b16999f8cadc16f97402e28252e6051c76670721b7e8461ed40df3b28` |

Internal families are **Aster Sans** and **Aster CJK SC**, renamed because they are modified OFL derivatives.
Filenames retain their original source-identifying names. See the byte-identical `FONT-LICENSE.txt` here.
Latin faces are subsets; CJK preserves the full unified repertoire. Duplicate lower-codepoint radical
aliases are removed from the cmap so Chromium PDF ToUnicode returns the actual source ideographs,
not radical aliases. This is not input rewriting, font fallback or a reduced CJK subset.

## Reproduce without overwriting approved assets

```sh
../font-venv/bin/python scripts/build-aster-fonts.py --output ../artifacts/aster-package/regenerated-fonts
# Compare every generated WOFF2 and FONT-LICENSE.txt against this directory with cmp.
```

Verified byte-identical with Python 3.12.3, fonttools 4.68.0, brotli 1.2.1.
The builder fixes each approved derivative's original `head.modified` value instead of using wall-clock time:
Latin 3876032048; CJK 3876032069 (OpenType seconds since 1904).
No network/download/global package installation is used. Normal JS builds consume checked-in WOFF2.

Local input SHA-256:

- `/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf`: `89c3c497f618fdaa0b2d1e98fef93582f28c71debd2c4a8cdf41f190ced2909d`
- `/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf`: `e83493c945848ecd4a9ad0f6d19164541a0d3e23a9c952304a00a46e00272ac5`
- `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc`, face 2: `b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a`

Gallery uses ordinary relative same-origin WOFF2 URLs and the unchanged Gallery precache policy.
The three WOFF2 bodies total **11488280 bytes**, cached once per release, not once per template.
They remain large: this is raw asset/body size, not a claim about compressed network transfer.
Standalone HTML embeds these exact bytes and belongs only in `../artifacts/standalone/`, outside distribution.
