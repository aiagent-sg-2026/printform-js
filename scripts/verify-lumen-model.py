#!/usr/bin/env python3
"""Consume actual JS inputs/outputs with the supplied independent Fraction oracle."""
import importlib.util, json, pathlib, sys
sys.dont_write_bytecode = True
root = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('lumen_oracle', root / 'gallery/designs/assets/lumen/oracle-generator.py')
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)
out = root.parent / 'artifacts/lumen'
snapshots = json.loads((out / 'model-snapshots.json').read_text())
for case in snapshots['snapshots']:
    if case['valid']:
        assert case['actual'] == oracle.expected(case['input']), case['name']
    else:
        try:
            oracle.validate(case['input'])
        except Exception:
            pass
        else:
            raise AssertionError('JS/oracle disagree on rejection: ' + case['name'])
for ratio in snapshots['ratios']:
    assert ratio == oracle.ratio(ratio['numerator'], ratio['denominator'])
result = {'passed': True, 'actualJSSnapshots': len(snapshots['snapshots']), 'exactRatioChecks': len(snapshots['ratios']), 'oracle': 'Supplied Python Draft202012 + Fraction, consuming actual JS source inputs and outputs'}
(out / 'model-oracle-results.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
