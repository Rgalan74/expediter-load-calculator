import os

out = []
for root, _, files in os.walk('public/academy'):
    for file in files:
        if file.endswith('.html'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                if 'data-lang="en"' not in f.read():
                    out.append(path)

with open('output.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
