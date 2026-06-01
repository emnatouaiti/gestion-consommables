#!/usr/bin/env python3
"""
Fix UTF-8 BOM in files listed by the BOM scan report.

Behaviour:
- Reads `backend/storage/logs/php_leading_bytes_scan.txt` (one path per line).
- Ignores paths that include `/vendor/`.
- For each file, if it starts with the UTF-8 BOM (0xEF,0xBB,0xBF), strips it in-place.
- Writes a log `backend/storage/logs/php_bom_fix_applied.txt` with a summary.

Run from the repository root: `python backend/tools/fix_php_bom.py`
"""
import os
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT = os.path.join(ROOT, 'storage', 'logs', 'php_leading_bytes_scan.txt')
OUT_LOG = os.path.join(ROOT, 'storage', 'logs', 'php_bom_fix_applied.txt')

if not os.path.exists(REPORT):
    print('Report not found:', REPORT)
    sys.exit(1)

fixed = []
skipped = []
missing = []

with open(REPORT, 'r', encoding='utf-8', errors='replace') as fh:
    lines = [l.strip() for l in fh if l.strip()]

for line in lines:
    # line format: fullpath :: BOM  or fullpath :: start:[...]
    path = line.split('::', 1)[0].strip()
    # skip vendor files
    if os.path.normcase('vendor') in os.path.normcase(path):
        skipped.append(path)
        continue
    # resolve to repo-relative absolute path
    if not os.path.isabs(path):
        path = os.path.join(ROOT, path)
    path = os.path.normpath(path)
    if not os.path.exists(path):
        missing.append(path)
        continue
    try:
        with open(path, 'rb') as f:
            data = f.read()
        if data.startswith(b'\xef\xbb\xbf'):
            new = data[3:]
            with open(path, 'wb') as f:
                f.write(new)
            fixed.append(path)
            print('Fixed BOM:', path)
        else:
            # not a UTF-8 BOM -- skip to avoid risky edits
            skipped.append(path)
    except Exception as e:
        print('Error processing', path, e)
        skipped.append(path)

now = datetime.utcnow().isoformat() + 'Z'
with open(OUT_LOG, 'a', encoding='utf-8') as out:
    out.write(f'[{now}] Fixed: {len(fixed)}, Skipped: {len(skipped)}, Missing: {len(missing)}\n')
    if fixed:
        out.write('Fixed files:\n')
        for p in fixed:
            out.write(p + '\n')
    if missing:
        out.write('Missing files:\n')
        for p in missing:
            out.write(p + '\n')

print('DONE. Fixed:', len(fixed), 'Skipped:', len(skipped), 'Missing:', len(missing))
