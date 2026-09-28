"""Build a standalone CampaignForge Pro site from the design screens.

Reads ../design/*.dc.html and writes index.html: one self-contained page
with a small template engine (holes, sc-for, sc-if, events, screen links).
Run: python3 build.py
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
DESIGN = os.path.join(HERE, '..', 'design')
ORDER = ['Home', 'Auth', 'Main', 'Brand', 'Dates', 'New', 'Plan', 'Score', 'Studio', 'Brief',
         'Reel', 'Publish', 'Budget', 'Timeline', 'Prioritise', 'Report']

screens, scripts = {}, []
for name in ORDER:
    src = open(os.path.join(DESIGN, name + '.dc.html'), encoding='utf-8').read()
    body = src[src.index('<x-dc>') + 6: src.index('</x-dc>')]
    helmet = re.search(r'<helmet>(.*?)</helmet>', body, re.S).group(1)
    css = '\n'.join(re.findall(r'<style>(.*?)</style>', helmet, re.S))
    html = re.sub(r'<helmet>.*?</helmet>', '', body, flags=re.S)
    # Loops and branches become <template> so the HTML parser keeps them inside tables.
    html = re.sub(r'<sc-for\b', '<template data-sc-for', html).replace('</sc-for>', '</template>')
    html = re.sub(r'<sc-if\b', '<template data-sc-if', html).replace('</sc-if>', '</template>')
    title = re.search(r'<title>(.*?)</title>', src).group(1)
    code = re.search(r'<script type="text/x-dc" data-dc-script[^>]*>(.*?)</script>', src, re.S).group(1)
    screens[name] = {'css': css, 'html': html.strip(), 'title': title}
    scripts.append('DC[%s] = (function () {\n%s\nreturn Component;\n})();' % (json.dumps(name), code.strip()))

data = json.dumps(screens, ensure_ascii=False).replace('</', '<\\/')
comp = '\n'.join(scripts).replace('</script', '<\\/script')
shell = open(os.path.join(HERE, 'shell.html'), encoding='utf-8').read()
out = shell.replace('/*SCREENS*/', data).replace('/*COMPONENTS*/', comp)
# page.html: body-only fragment (for hosts that add their own document skeleton).
open(os.path.join(HERE, 'page.html'), 'w', encoding='utf-8').write(out)
# index.html: full document for GitHub Pages or any static host.
full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n'
        + out + '\n</body>\n</html>\n')
open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8').write(full)
print('wrote index.html and page.html', len(full), 'bytes')
