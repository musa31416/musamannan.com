#!/usr/bin/env python3
"""Encrypt (or decrypt) the password-protected /leemlab section.

The plaintext source lives OUTSIDE this public repo. Only ciphertext is
committed: every page, figure, PDF and Word file is AES-256-GCM encrypted
with a key derived from the password (PBKDF2-SHA256). The browser derives the
same key from the password and decrypts in place (leemlab/_gate/*.js).

  LEEMLAB_PASSWORD=... python3 tools/leemlab_crypt.py encrypt <plain_src_dir>
  LEEMLAB_PASSWORD=... python3 tools/leemlab_crypt.py decrypt <out_dir>

encrypt rebuilds leemlab/ (keeping leemlab/_gate/) from the source folder.
decrypt recovers the full plaintext tree from the published ciphertext.
The salt in leemlab/_gate/config.json is reused so remembered devices keep
working; a different password is refused unless --new-password is given.
Requires: pip install cryptography
"""
import base64, json, os, re, shutil, sys, posixpath
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(REPO, 'leemlab')
GATE = os.path.join(SITE, '_gate')
CFG = os.path.join(GATE, 'config.json')
ITER = 600_000
CHECK = b'leemlab-ok'
PLAIN = {'proposals/proposals.css', 'proposals/reader.js'}   # shared, no licensed content
URL_ROOT = '/leemlab/'

b64 = lambda b: base64.b64encode(b).decode()

def derive(pw, salt):
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER).derive(pw.encode())

def enc(key, data):
    iv = os.urandom(12)
    return iv + AESGCM(key).encrypt(iv, data, None)

def dec(key, blob):
    return AESGCM(key).decrypt(blob[:12], blob[12:], None)

def load_key(new=False):
    pw = os.environ.get('LEEMLAB_PASSWORD')
    if not pw: sys.exit('Set LEEMLAB_PASSWORD')
    if os.path.exists(CFG) and not new:
        c = json.load(open(CFG)); salt = base64.b64decode(c['salt'])
        key = derive(pw, salt)
        try: dec(key, base64.b64decode(c['check']))
        except Exception: sys.exit('Password does not match the published one (use --new-password to change it).')
        return key, c
    salt = os.urandom(16); key = derive(pw, salt)
    c = {'v': 1, 'kdf': 'PBKDF2-SHA256', 'iter': ITER, 'salt': b64(salt), 'check': b64(enc(key, CHECK))}
    return key, c

SHELL = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Leem Lab | Locked</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/leemlab/_gate/gate.css">
</head>
<body>
<main class="gate" id="gate" hidden>
  <img src="/img/avatar.jpg" alt="" width="56" height="56">
  <h1>Leem Lab</h1>
  <p>This section is private. Enter the password to continue.</p>
  <form id="gate-form" autocomplete="on">
    <input type="text" name="username" value="leemlab" autocomplete="username" hidden>
    <input id="gate-pw" type="password" name="password" autocomplete="current-password" placeholder="Password" required autofocus>
    <label class="rem"><input id="gate-rem" type="checkbox" checked> Remember this device</label>
    <button type="submit">Unlock</button>
    <p class="err" id="gate-err" role="alert"></p>
  </form>
  <a class="home" href="/">&larr; musamannan.com</a>
</main>
<p class="gate-wait" id="gate-wait">Opening&hellip;</p>
<noscript><p class="gate-wait">This section needs JavaScript.</p></noscript>
<script src="/leemlab/_gate/gate.js" data-payload="{payload}"></script>
</body>
</html>
'''

ATTR = re.compile(r'(<(?:img|a|source)\b[^>]*?\s)(src|href)="([^"#?]+)"', re.I)

def rewrite(html, rel, files):
    """Point local encrypted assets at data-e* attributes for the browser helper."""
    base = posixpath.dirname(rel)
    def rep(m):
        pre, attr, url = m.groups()
        if re.match(r'^[a-z]+:|^//', url, re.I): return m.group(0)
        if url.startswith(URL_ROOT): target = url[len(URL_ROOT):]
        elif url.startswith('/'): return m.group(0)
        else: target = posixpath.normpath(posixpath.join(base, url))
        if target in files and not target.endswith('.html') and target not in PLAIN:
            if attr.lower() == 'src': return f'{pre}data-esrc="{url}"'
            return f'{pre}href="#" data-ehref="{url}"'
        return m.group(0)
    html = ATTR.sub(rep, html)
    tag = '<script src="/leemlab/_gate/assets.js"></script>'
    return html.replace('</body>', tag + '\n</body>') if '</body>' in html else html + tag

def encrypt(src):
    key, cfg = load_key('--new-password' in sys.argv)
    src = os.path.abspath(src)
    files = set()
    for d, _, fs in os.walk(src):
        for f in fs: files.add(os.path.relpath(os.path.join(d, f), src).replace(os.sep, '/'))
    # wipe old output except the gate code
    for name in os.listdir(SITE):
        if name == '_gate': continue
        p = os.path.join(SITE, name); shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    n = 0
    for rel in sorted(files):
        data = open(os.path.join(src, rel), 'rb').read()
        out = os.path.join(SITE, rel); os.makedirs(os.path.dirname(out), exist_ok=True)
        if rel in PLAIN:
            open(out, 'wb').write(data); continue
        if rel.endswith('.html'):
            html = rewrite(data.decode('utf-8'), rel, files)
            open(out + '.enc', 'wb').write(enc(key, html.encode('utf-8')))
            open(out, 'w').write(SHELL.format(payload=posixpath.basename(rel) + '.enc'))
        else:
            open(out + '.enc', 'wb').write(enc(key, data))
        n += 1
    json.dump(cfg, open(CFG, 'w'), indent=1)
    print(f'encrypted {n} files, {len(PLAIN & files)} shared plain files')

def decrypt(out):
    key, _ = load_key()
    for d, _, fs in os.walk(SITE):
        if os.path.relpath(d, SITE).startswith('_gate'): continue
        for f in fs:
            p = os.path.join(d, f); rel = os.path.relpath(p, SITE)
            if f.endswith('.html') and os.path.exists(p + '.enc'): continue
            dst = os.path.join(out, rel[:-4] if f.endswith('.enc') else rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            data = open(p, 'rb').read()
            if f.endswith('.enc'):
                data = dec(key, data)
                if dst.endswith('.html'):
                    s = data.decode('utf-8').replace('<script src="/leemlab/_gate/assets.js"></script>\n', '')
                    s = re.sub(r'href="#" data-ehref="', 'href="', s); s = s.replace('data-esrc="', 'src="')
                    data = s.encode('utf-8')
            open(dst, 'wb').write(data)
    print('decrypted to', out)

if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in ('encrypt', 'decrypt'): sys.exit(__doc__)
    encrypt(sys.argv[2]) if sys.argv[1] == 'encrypt' else decrypt(sys.argv[2])
