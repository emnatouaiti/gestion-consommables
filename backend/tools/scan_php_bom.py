import os
root = r'c:\Users\emnat\OneDrive\Desktop\consotrack\backend'
bad = []
for dirpath, dirs, files in os.walk(root):
    for f in files:
        if f.endswith('.php'):
            p = os.path.join(dirpath, f)
            try:
                with open(p, 'rb') as fh:
                    b = fh.read(4)
                if b.startswith(b'\xef\xbb\xbf'):
                    bad.append((p, 'BOM'))
                elif not b.startswith(b'<?ph'):
                    bad.append((p, 'start:' + str(list(b))))
            except Exception as e:
                bad.append((p, 'error:' + str(e)))
out_path = os.path.join(root, 'storage', 'logs', 'php_leading_bytes_scan.txt')
with open(out_path, 'w', encoding='utf-8') as out:
    for p, s in bad:
        out.write(f'{p} :: {s}\n')
    out.write(f'DONE {len(bad)}\n')
for p, s in bad:
    print(f'{p} :: {s}')
print('DONE', len(bad))
