"""Independent schema + Fraction verification of actual JS model snapshots.
Run the Node snapshot command documented in Atlas README first. No UI imports.
"""
import json
from fractions import Fraction
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

root = Path(__file__).resolve().parent.parent
out = root.parent / 'artifacts' / 'atlas'
source = root / 'gallery' / 'designs' / 'assets' / 'atlas'
schema = json.loads((source / 'schema.json').read_text())
validator = Draft202012Validator(schema, format_checker=FormatChecker())


def allocation(amount, ids, bases):
    ids = sorted(ids)
    shares = dict.fromkeys(ids, 0)
    reason = None
    if amount and any(bases[i] is None for i in ids):
        reason = 'missing-basis'
    elif amount and not sum(bases[i] for i in ids):
        reason = 'zero-basis'
    if amount and not reason:
        ideals = {i: Fraction(abs(amount) * bases[i], sum(bases[j] for j in ids)) for i in ids}
        floors = {i: ideals[i].numerator // ideals[i].denominator for i in ids}
        order = sorted(ids, key=lambda i: (-(ideals[i] - floors[i]), i))
        for i in order[:abs(amount) - sum(floors.values())]:
            floors[i] += 1
        shares = {i: floors[i] * (-1 if amount < 0 else 1) for i in ids}
    return {'allocationsCents': shares, 'unallocatedCents': amount if reason else 0, 'reason': reason}


def check(data, basis, mode, actual):
    validator.validate(data)
    goods = {l['id']: l['quantity'] * l['unitGoodsCents'] for l in data['lines']}
    bases = {}
    for l in data['lines']:
        extended_weight = 0 if l['quantity'] == 0 else None if l['unitWeightGrams'] is None else l['quantity'] * l['unitWeightGrams']
        bases[l['id']] = goods[l['id']] if basis == 'value' else l['quantity'] if basis == 'quantity' else extended_weight
    charges = {c['id']: allocation(c[mode + 'Cents'], c['eligibleLineIds'], bases) for c in data['charges']}
    fees = {i: sum(c['allocationsCents'].get(i, 0) for c in charges.values()) for i in goods}
    landed = {i: goods[i] + fees[i] for i in goods}
    expected = {'goodsTotalCents': sum(goods.values()), 'chargeTotalCents': sum(c[mode + 'Cents'] for c in data['charges']),
                'allocatedFeesCents': sum(fees.values()), 'unallocatedFeesCents': sum(c['unallocatedCents'] for c in charges.values()),
                'landedTotalCents': sum(landed.values()), 'lineAllocatedFeesCents': fees, 'lineLandedCents': landed, 'chargeAllocations': charges}
    assert actual == expected, (basis, mode)
    for c in data['charges']:
        a = charges[c['id']]
        assert sum(a['allocationsCents'].values()) + a['unallocatedCents'] == c[mode + 'Cents']
    assert sum(landed.values()) + expected['unallocatedFeesCents'] == sum(goods.values()) + expected['chargeTotalCents']


snapshots = json.loads((out / 'model-snapshots.json').read_text())
for s in snapshots:
    check(s['source'], s['basis'], s['mode'], s['totals'])
print(f'{len(snapshots)} actual JS snapshots: schema + independently recomputed per-charge/per-line Fraction allocations passed.')
