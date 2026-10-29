import json, pathlib
from fractions import Fraction
from collections import defaultdict
p=pathlib.Path(__file__).resolve().parent
names=['Fictional hinge assembly','Modular cable tray','Packing separator set','Precision mounting plate','Reusable transport sleeve','Control enclosure shell','Adjustable bracket pair','Protective corner kit','Service access panel','Synthetic spacer pack','Workshop storage rail','Non-powered connector housing']
lines=[]
for i in range(1,25):
 lines.append({'id':f'LIN-{i:03d}','containerId':f'CONT-{1+(i-1)//8:02d}','sku':f'DEMO-SKU-{i:03d}','description':names[(i-1)%len(names)]+f' / specimen {i:02d}','quantity':5+(i%6)*3,'unitGoodsCents':1250+175*i,'unitWeightGrams':250+(i%5)*125})
charges=[]
for id,title,scope,est,actual in [
 ('CHG-01','Synthetic ocean transport',None,160000,180000),
 ('CHG-02','Container 01 handling',['CONT-01'],22000,24000),
 ('CHG-03','Container 02 handling',['CONT-02'],24000,27000),
 ('CHG-04','Container 03 handling',['CONT-03'],20000,21000),
 ('CHG-05','Terminal service example',None,40000,45000),
 ('CHG-06','Illustrative cargo cover service',None,16000,18000),
 ('CHG-07','Synthetic service credit',None,-10000,-12000),
 ('CHG-08','Inspection example / containers 02 and 03',['CONT-02','CONT-03'],30000,36000)]:
 ids=[l['id'] for l in lines if scope is None or l['containerId'] in scope]
 charges.append({'id':id,'description':title,'eligibleLineIds':ids,'scopeContainerIds':scope or [f'CONT-{i:02d}' for i in range(1,4)],'estimatedCents':est,'actualCents':actual,'sourceRef':f'DEMO-SRC-{id}'})
data={'schemaVersion':1,'document':{'id':'ATLAS-DEMO-2026-001','title':'Landed Cost Dossier','company':'Atlas Fictional Logistics Studio','currency':'SGD','asOfDate':'2026-10-28','notice':'SAMPLE — fictional costing data; not a customs declaration, invoice or payment instruction'},'shipment':{'id':'SHIP-DEMO-042','origin':'Example Port Alpha','destination':'Example Port Delta','routeLabel':'Fictional sea route / demonstration only','departureDate':'2026-10-12','arrivalDate':'2026-10-26'},'containers':[{'id':f'CONT-{i:02d}','label':f'Fictional container {i:02d}','reference':f'DEMO-CONTAINER-{i:02d}','sealReference':f'DEMO-SEAL-{i:02d}'} for i in range(1,4)],'lines':lines,'charges':charges}
(p/'atlas-default-24.json').write_text(json.dumps(data,indent=2)+'\n')
def alloc(amount, ids, bases):
 ids=sorted(ids)
 if amount==0:return {'allocationsCents':{i:0 for i in ids},'unallocatedCents':0,'reason':None}
 if any(bases[i] is None for i in ids):return {'allocationsCents':{i:0 for i in ids},'unallocatedCents':amount,'reason':'missing-basis'}
 total=sum(bases[i] for i in ids)
 if not total:return {'allocationsCents':{i:0 for i in ids},'unallocatedCents':amount,'reason':'zero-basis'}
 mag=abs(amount);sign=-1 if amount<0 else 1
 shares={i:Fraction(mag*bases[i],total) for i in ids};floors={i:shares[i].numerator//shares[i].denominator for i in ids}
 rest=mag-sum(floors.values()); ranked=sorted(ids,key=lambda i:(-(shares[i]-floors[i]),i))
 for i in ranked[:rest]:floors[i]+=1
 out={i:sign*floors[i] for i in ids};assert sum(out.values())==amount
 return {'allocationsCents':out,'unallocatedCents':0,'reason':None}
result={}
for basis in ['value','quantity','weight']:
 bs={l['id']:(l['quantity']*l['unitGoodsCents'] if basis=='value' else l['quantity'] if basis=='quantity' else l['quantity']*l['unitWeightGrams']) for l in lines}
 for mode in ['estimated','actual']:
  by={c['id']:alloc(c[mode+'Cents'],c['eligibleLineIds'],bs) for c in charges}
  fee={l['id']:sum(a['allocationsCents'].get(l['id'],0) for a in by.values()) for l in lines}
  goods={l['id']:l['quantity']*l['unitGoodsCents'] for l in lines}
  landed={i:goods[i]+fee[i] for i in goods}
  result[basis+'-'+mode]={'goodsTotalCents':sum(goods.values()),'chargeTotalCents':sum(c[mode+'Cents'] for c in charges),'allocatedFeesCents':sum(fee.values()),'unallocatedFeesCents':sum(a['unallocatedCents'] for a in by.values()),'landedTotalCents':sum(landed.values()),'lineAllocatedFeesCents':fee,'lineLandedCents':landed,'chargeAllocations':by}
fixtures=[{'id':'positive-residual-tie','amountCents':5,'ids':['L-C','L-A','L-B'],'basis':{'L-A':1,'L-B':1,'L-C':1}}, {'id':'negative-residual-tie','amountCents':-5,'ids':['L-C','L-A','L-B'],'basis':{'L-A':1,'L-B':1,'L-C':1}}, {'id':'unequal-positive','amountCents':7,'ids':['L-A','L-B','L-C'],'basis':{'L-A':1,'L-B':2,'L-C':3}}, {'id':'zero-basis','amountCents':101,'ids':['L-A','L-B'],'basis':{'L-A':0,'L-B':0}}, {'id':'missing-basis','amountCents':101,'ids':['L-A','L-B'],'basis':{'L-A':20,'L-B':None}}, {'id':'missing-basis-credit','amountCents':-101,'ids':['L-A','L-B'],'basis':{'L-A':20,'L-B':None}}, {'id':'zero-charge','amountCents':0,'ids':['L-A','L-B'],'basis':{'L-A':None,'L-B':0}}, {'id':'empty-scope','amountCents':101,'ids':[],'basis':{}}]
for f in fixtures:f['expected']=alloc(f['amountCents'],f['ids'],f['basis'])
missing={l['id']:None if l['id']=='LIN-010' else l['quantity']*l['unitWeightGrams'] for l in lines}
missingBy={c['id']:alloc(c['actualCents'],c['eligibleLineIds'],missing) for c in charges}
expected={'oracleMethod':'Python fractions.Fraction, independent rational arithmetic; never import expected values into UI','defaultScenarios':result,'allocationUnitFixtures':fixtures,'missingWeightActual':{'missingLineId':'LIN-010','chargeAllocations':missingBy,'allocatedFeesCents':sum(sum(a['allocationsCents'].values()) for a in missingBy.values()),'unallocatedFeesCents':sum(a['unallocatedCents'] for a in missingBy.values())}}
(p/'atlas-default-24.expected.json').write_text(json.dumps(expected,indent=2)+'\n')
validation={'fictional':True,'lines':len(lines),'containers':3,'charges':len(charges),'quantityTotal':sum(l['quantity'] for l in lines),'weightTotalGrams':sum(l['quantity']*l['unitWeightGrams'] for l in lines),'goodsTotalCents':result['value-actual']['goodsTotalCents'],'estimatedChargesCents':302000,'actualChargesCents':339000,'estimatedLandedCents':result['value-estimated']['landedTotalCents'],'actualLandedCents':result['value-actual']['landedTotalCents'],'chargeVarianceCents':37000,'missingWeightActual':{k:v for k,v in expected['missingWeightActual'].items() if k!='chargeAllocations'},'allSixDefaultScenariosConserveCents':True,'browserRendered':False}
assert all(r['allocatedFeesCents']+r['unallocatedFeesCents']==r['chargeTotalCents'] for r in result.values())
(p/'DESIGN_VALIDATION.json').write_text(json.dumps(validation,indent=2)+'\n');print(json.dumps(validation,indent=2))
