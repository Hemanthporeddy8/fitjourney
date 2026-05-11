import os
import json

with open('fitjourneynet_v2_train.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    l = line.replace('\t', '    ').rstrip()
    if 'print(f"Train Loss:' in line or 'print(f"  Epoch {epoch}' in line:
        if 'Train Loss' in line:
            new_lines.append('        print(f"Train Loss: {train_loss:.4f} Val Loss: {val_loss:.4f} PCKh: {val_pckh:.1f}%")\n')
        else:
            new_lines.append('            print(f"Epoch {epoch} batch {batch_idx} loss {loss.item():.4f}")\n')
        skip = True
        continue
    if skip and (')' in l or '%' in l or 'PCKh' in l):
        skip = False
        continue
    if skip: continue
    new_lines.append(l + '\n')

final = ''.join(new_lines)
with open('fitjourneynet_v2_fixed_production.py', 'w', encoding='utf-8') as f:
    f.write(final)

nb = {
    'cells': [{'cell_type': 'code', 'execution_count': None, 'metadata': {}, 'outputs': [], 'source': [final]}],
    'metadata': {'kernelspec': {'display_name': 'Python 3', 'name': 'python3'}, 'language_info': {'name': 'python'}},
    'nbformat': 4, 'nbformat_minor': 4
}
with open('FitJourneyNet_V2_FIXED_FINAL.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print("SUCCESS")
