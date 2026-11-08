"""Export only freshly generated sample data, never the real workspace database."""
import json
import os
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
with tempfile.TemporaryDirectory(prefix='baihuali-trial-seed-') as directory:
    os.environ['BAIHUALI_DATA_DIR'] = directory
    from backend.app import state
    from backend.standards import COURSES, SCORE_PARTS, POLICIES
    payload = {'data': state({'tenant': 'demo'}), 'standards': {'courses': COURSES, 'parts': SCORE_PARTS, 'policies': POLICIES}}
    (root / 'frontend/src/trial/seed.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
print('Exported fresh sample data and original course standards; no live data read.')
