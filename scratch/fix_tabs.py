import os
import json

def fix_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace all tabs with 4 spaces to avoid mixing
    content = content.replace('\t', '    ')
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file('fitjourneynet_v2_train.py')

# Regenerate notebook
with open('fitjourneynet_v2_train.py', 'r', encoding='utf-8') as f:
    v2_content = f.read()

nb = {
    'cells': [
        {'cell_type': 'markdown', 'metadata': {}, 'source': ['# FitJourneyNet V2 (TAB FIX)\n']},
        {'cell_type': 'code', 'execution_count': None, 'metadata': {}, 'outputs': [], 'source': [v2_content]}
    ],
    'metadata': {'kernelspec': {'display_name': 'Python 3', 'name': 'python3'}, 'language_info': {'name': 'python'}},
    'nbformat': 4, 'nbformat_minor': 4
}
with open('FitJourneyNet_V2_FINAL.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print("SUCCESS")
