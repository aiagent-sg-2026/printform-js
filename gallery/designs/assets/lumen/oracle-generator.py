#!/usr/bin/env python3
"""Independent PF-067 design oracle. Python/Fraction; no PrintForm/JS dependency."""
import copy, datetime, json, pathlib
from fractions import Fraction
from jsonschema import Draft202012Validator
ROOT=pathlib.Path(__file__).resolve().parent

def obj(p, required=None):
 return {'type':'object','additionalProperties':False,'properties':p,'required':list(p) if required is None else required}
def arr(s,minn=0,maxn=500):return {'type':'array','items':s,'minItems':minn,'maxItems':maxn}
S={'type':'string','minLength':1,'maxLength':12000}; ID={'type':'string','pattern':'^[A-Z][A-Z0-9-]{1,39}$'}
N={'type':['integer','null'],'minimum':0,'maximum':10000}; DATE={'type':'string','format':'date'}
SCHEMA={'$schema':'https://json-schema.org/draft/2020-12/schema', **obj({
 'schemaVersion':{'const':1},'document':obj({'id':ID,'title':S,'issued':DATE,'notice':S}),
 'school':obj({'name':S,'address':S,'teacher':S}),
 'child':obj({'id':ID,'pseudonym':S,'className':S,'ageBand':S,'introduction':S}),
 'semesters':arr(obj({'id':ID,'label':S,'start':DATE,'end':DATE,'attendance':obj({'scheduled':N,'present':N,'absent':N,'unknown':N})}),1,2),
 'domains':arr(obj({'id':ID,'title':S,'description':S,'lookFors':arr(S,1,4)}),4,12),
 'reflections':arr(obj({'domainId':ID,'semesterId':ID,'status':{'enum':['exploring','with-support','independently','not-observed']},'comment':S}),0,24),
 'evidence':arr(obj({'id':ID,'domainIds':arr(ID,1,12),'semesterId':ID,'date':DATE,'status':{'enum':['observed','planned']},'title':S,'description':S,'teacherNote':S}),0,120),
 'goals':arr(obj({'id':ID,'domainId':ID,'title':S,'strategy':S,'familyIdea':S,'reviewDate':DATE,'evidenceIds':arr(ID,0,20)}),0,30),
 'communications':arr(obj({'id':ID,'semesterId':ID,'date':DATE,'channel':{'enum':['conference','note','home-activity']},'topic':S,'summary':S,'nextStep':S}),0,30),
 'teacherReview':obj({'summary':S,'strengths':arr(S,0,12),'nextSteps':arr(S,0,12),'reviewer':S,'status':{'enum':['draft','reviewed']}})
})}

def validate(d):
 Draft202012Validator(SCHEMA,format_checker=Draft202012Validator.FORMAT_CHECKER).validate(d)
 if len(d['domains']) not in (4,8,12):raise ValueError('domain count must be 4, 8 or 12')
 for key in ['domains','semesters','evidence','goals','communications']:
  ids=[x['id'] for x in d[key]]
  if len(ids)!=len(set(ids)):raise ValueError('duplicate ID in '+key)
 ds={x['id'] for x in d['domains']}; ss={x['id']:x for x in d['semesters']}; es={x['id']:x for x in d['evidence']}
 previous_end=None
 for s in ss.values():
  if previous_end is not None and s['start']<=previous_end:raise ValueError('semester order or overlap')
  previous_end=s['end']
  if s['start']>s['end']:raise ValueError('reversed semester dates')
  a=s['attendance']; vals=list(a.values())
  if any(v is None for v in vals) and not all(v is None for v in vals):raise ValueError('attendance must be wholly known or wholly missing')
  if vals[0] is not None and a['present']+a['absent']+a['unknown']!=a['scheduled']:raise ValueError('attendance conservation')
 seen=set()
 for r in d['reflections']:
  k=(r['domainId'],r['semesterId'])
  if k in seen:raise ValueError('duplicate reflection cell')
  seen.add(k)
  if r['domainId'] not in ds or r['semesterId'] not in ss:raise ValueError('unknown reflection reference')
 for e in d['evidence']:
  if e['semesterId'] not in ss or not set(e['domainIds'])<=ds:raise ValueError('unknown evidence reference')
  if len(e['domainIds'])!=len(set(e['domainIds'])):raise ValueError('duplicate domain reference')
  s=ss[e['semesterId']]
  if not s['start']<=e['date']<=s['end']:raise ValueError('evidence outside semester')
 for g in d['goals']:
  if g['domainId'] not in ds or not set(g['evidenceIds'])<=set(es):raise ValueError('unknown goal reference')
  if len(g['evidenceIds'])!=len(set(g['evidenceIds'])):raise ValueError('duplicate goal evidence')
 for c in d['communications']:
  if c['semesterId'] not in ss:raise ValueError('unknown communication reference')
  s=ss[c['semesterId']]
  if not s['start']<=c['date']<=s['end']:raise ValueError('communication outside semester')
 return d

def ratio(n,d):
 if d==0:return {'numerator':n,'denominator':d,'percent1dp':None}
 f=Fraction(n*1000,d); rounded=(2*f.numerator+f.denominator)//(2*f.denominator)
 return {'numerator':n,'denominator':d,'percent1dp':f'{rounded//10}.{rounded%10}'}

def expected(d):
 validate(d); obs=[e for e in d['evidence'] if e['status']=='observed']; cells=[]
 for s in d['semesters']:
  for dom in d['domains']:
   ids=[e['id'] for e in obs if e['semesterId']==s['id'] and dom['id'] in e['domainIds']]
   r=next((r for r in d['reflections'] if r['semesterId']==s['id'] and r['domainId']==dom['id']),None)
   cells.append({'semesterId':s['id'],'domainId':dom['id'],'observedEvidenceIds':ids,'observedEvidenceCount':len(ids),'reflectionStatus':None if r is None else r['status']})
 attendance=[]
 for s in d['semesters']:
  a=s['attendance']; missing=a['scheduled'] is None
  attendance.append({'semesterId':s['id'],'state':'missing' if missing else 'recorded',
   'knownAttendanceRate':None if missing else ratio(a['present'],a['present']+a['absent']),
   'recordingCoverage':None if missing else ratio(a['present']+a['absent'],a['scheduled'])})
 return {'documentId':d['document']['id'],'domainCount':len(d['domains']),'semesterCount':len(d['semesters']),
  'observedRecordCount':len(obs),'plannedRecordCount':len(d['evidence'])-len(obs),
  'evidenceCoverage':ratio(sum(bool(c['observedEvidenceCount']) for c in cells),len(cells)),
  'coverageMeaning':'domain-semester cells with at least one observed evidence record / all configured domain-semester cells; not ability or development score',
  'cells':cells,'attendance':attendance,'goalCount':len(d['goals']),'communicationCount':len(d['communications'])}

TITLES=['Language & storytelling / 语言表达','Early numeracy / 初步数学','Discovery & inquiry / 探索发现','Creative expression / 创意表达','Movement & coordination / 动作协调','Social connection / 社交互动','Self-management / 自我管理','Care for our world / 关爱环境','Music & rhythm / 音乐节奏','Construction & design / 建构设计','Listening & reflection / 聆听反思','Everyday independence / 生活自主']
def sample(n=8,terms=2):
 d={'schemaVersion':1,'document':{'id':'LUMEN-DEMO-067','title':'Lumen Learning Progress Portfolio / 学习成长档案','issued':'2026-11-20','notice':'FICTIONAL DEMO — teacher-reviewed illustrative records, not an assessment or real child record.'},
 'school':{'name':'Lumen Grove Learning Studio — Fictional','address':'18 Imaginary Garden, Example City','teacher':'Demo Educator Rowan'},
 'child':{'id':'CHILD-DEMO-01','pseudonym':'Demo Robin','className':'Garden Explorers — fictional class','ageBand':'Illustrative preschool group; no real birth date','introduction':'Robin is a fictional learner created to demonstrate a portfolio. This sample connects classroom observations, descriptive reflections and practical next steps. 本档案仅使用虚构资料，展示观察、教师反思与家庭活动如何关联。'},
 'semesters':[], 'domains':[], 'reflections':[], 'evidence':[], 'goals':[], 'communications':[],
 'teacherReview':{'summary':'Draft for demonstration. Read each observation in context and check the source references before discussing next steps. 本示例不作能力排名，也不替代教师的专业判断。','strengths':['Enjoys explaining a construction idea with a partner.','Shows curiosity when comparing natural materials.'], 'nextSteps':['Offer a quieter small-group storytelling invitation.','Revisit recorded observations with the learner and family.'],'reviewer':'Demo Educator Rowan','status':'draft'}}
 for t in range(terms):
  sid=f'TERM-0{t+1}';start='2026-01-01' if t==0 else '2026-07-01';end='2026-06-30' if t==0 else '2026-11-30'
  d['semesters'].append({'id':sid,'label':f'Semester {t+1} / 学期 {t+1}','start':start,'end':end,'attendance':{'scheduled':100 if t==0 else 90,'present':88 if t==0 else 79,'absent':7 if t==0 else 6,'unknown':5}})
 for i in range(n):
  did=f'DOM-{i+1:02}';d['domains'].append({'id':did,'title':TITLES[i],'description':'An invitation to notice learning in everyday play, not a benchmark or ranking. 关注日常游戏中的学习过程，不作标准化排名。','lookFors':['Describe the context and the learner’s own words.','Record support offered and a possible next invitation.']})
  for t in range(terms):
   sid=f'TERM-0{t+1}'
   if not(i==n-1 and t==terms-1):d['reflections'].append({'domainId':did,'semesterId':sid,'status':['exploring','with-support','independently'][((i+t)%3)],'comment':'During a small-group invitation, Robin explored materials and explained one choice. The educator offered time and a clear question rather than a fixed answer. 小组活动中，Robin尝试使用材料并说明自己的选择；教师提供等待时间与开放问题。'})
   if i==n-1 and t==terms-1:continue
   d['evidence'].append({'id':f'EV-{t+1}-{i+1:02}','domainIds':[did], 'semesterId':sid,'date':f'2026-{3 if t==0 else 9:02}-{i+2:02}','status':'planned' if i==n-2 and t==terms-1 else 'observed','title':f'Learning invitation {i+1} / 学习活动','description':'Robin selected two materials, tried a different arrangement and shared an idea with a peer. This record describes the moment without inferring a fixed trait. Robin选择了两种材料，尝试另一种排列，并与同伴分享想法。','teacherNote':'Next, offer another opportunity in a different context and record what changes. 下一次在不同情境中再次观察，并记录支持方式。'})
  if i%2==0:d['goals'].append({'id':f'GOAL-{i+1:02}','domainId':did,'title':'Extend an idea through a second invitation','strategy':'Offer choice, wait time and a simple visual cue; document the response.','familyIdea':'Try a playful shared task with everyday safe materials. 家庭可使用安全日常材料共同游戏。','reviewDate':'2026-12-04','evidenceIds':[f'EV-1-{i+1:02}']})
 for t in range(terms):
  d['communications'].append({'id':f'COM-{t+1:02}','semesterId':f'TERM-0{t+1}','date':f'2026-{5 if t==0 else 10:02}-14','channel':'conference','topic':'Shared observations and a small next step / 共同观察与下一步','summary':'Fictional family and educator compared what was noticed in different settings; differences were retained rather than averaged.','nextStep':'Invite a short family note; no response is required for this demonstration.'})
 return d

def main():
 ROOT.mkdir(exist_ok=True);d=sample();write=lambda f,x:(ROOT/f).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
 write('lumen.schema.json',SCHEMA);write('lumen-default.json',d);write('lumen-default.expected.json',expected(d))
 cases=[]
 def good(name,x):cases.append({'name':name,'valid':True,'input':x,'expected':expected(x)})
 def bad(name,x):
  try:expected(x)
  except Exception as e:cases.append({'name':name,'valid':False,'input':x,'error':str(e).splitlines()[0]});return
  raise AssertionError(name)
 x=sample(4,1);x['reflections']=[];x['evidence']=[];x['goals']=[];x['semesters'][0]['attendance']={k:None for k in x['semesters'][0]['attendance']};good('all-missing',x)
 x=sample(4,1)
 for e in x['evidence']:e['status']='planned'
 good('zero-observed-planned-not-observed',x)
 x=sample(4,1);x['semesters'][0]['attendance']={k:0 for k in x['semesters'][0]['attendance']};good('zero-denominator',x)
 for name,mut in [('duplicate-id',lambda x:x['domains'].__setitem__(1,copy.deepcopy(x['domains'][0]))),('invalid-date',lambda x:x['document'].__setitem__('issued','2026-02-30')),('unknown-reference',lambda x:x['evidence'][0].__setitem__('domainIds',['DOM-UNKNOWN'])),('attendance-mismatch',lambda x:x['semesters'][0]['attendance'].__setitem__('present',99))]:
  x=sample(4,1);mut(x);bad(name,x)
 # Compact mutation fixtures retain only changes; expected values still from independent full inputs.
 compact=[]
 for c in cases:
  base=sample(4,1);diff={k:v for k,v in c['input'].items() if v!=base[k]};compact.append({k:v for k,v in c.items() if k!='input'}|{'base':'sample(4,1)','replaceTopLevel':diff})
 write('lumen-edge-cases.json',compact)
 matrix=[]
 for n in [4,8,12]:
  for t in [1,2]:matrix.append({'domains':n,'semesters':t,'expected':expected(sample(n,t))})
 write('lumen-scenario.expected.json',matrix)
 write('DESIGN_VALIDATION.json',{'passed':True,'oracle':'Python Fraction + JSON Schema Draft202012 + semantic references/date/conservation checks','default':expected(d),'validEdgeCases':3,'invalidEdgeCases':4,'scaleScenarios':6,'testMeaning':'design data/model oracle only; no browser, PrintForm implementation, PDF or visual acceptance performed'})
 print(json.dumps({'default':expected(d),'files':{p.name:p.stat().st_size for p in ROOT.iterdir() if p.is_file()}},ensure_ascii=False))
if __name__=='__main__':main()
