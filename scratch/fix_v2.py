import os
import json

with open('fitjourneynet_v2_train.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if 'print(f"  Epoch {epoch}' in line:
        new_lines.append('            print(f"  Epoch {epoch} [{batch_idx}/{len(loader)}] Loss: {loss.item():.4f} PCKh: {pckh:.1f}%")\n')
        skip = True
        continue
    if skip and 'PCKh:' in line:
        skip = False
        continue
    if skip:
        continue
    new_lines.append(line)

with open('fitjourneynet_v2_train.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

with open('fitjourneynet_v2_train.py', 'r', encoding='utf-8') as f:
    v2_content = f.read()

nb = {
    'cells': [
        {'cell_type': 'markdown', 'metadata': {}, 'source': ['# FitJourneyNet V2 (BUG FIXED)\n']},
        {'cell_type': 'code', 'execution_count': None, 'metadata': {}, 'outputs': [], 'source': [v2_content]}
    ],
    'metadata': {'kernelspec': {'display_name': 'Python 3', 'name': 'python3'}, 'language_info': {'name': 'python'}},
    'nbformat': 4, 'nbformat_minor': 4
}
with open('FitJourneyNet_V2_FINAL.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print("SUCCESS")
