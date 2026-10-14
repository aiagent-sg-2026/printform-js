import {describe,it,expect} from 'vitest';
import {createScenario,createProjectScenario} from '../../studio-v2/core/sample-scenarios.js';
import {createProgressClaimProject} from '../../studio-v2/samples/progress-claim.js';
import {validateData} from '../../studio-v2/core/schema.js';
import {bindTemplate} from '../../studio-v2/core/binding.js';
import {CommandBus} from '../../studio-v2/core/command-bus.js';

describe('declared collection layout stress',()=> {
  it('never chooses the first discoverable array or modifies other collections',()=> {
    const sample={address:['Line 1','Line 2'],items:[{no:1,description:'A',amount:7}],rows:[{no:'A',description:'B',amount:'1,234.56'}],totals:{subtotal:91,tax:17,grandTotal:108}};
    const data=createScenario(sample,'45-rows','/rows');
    expect(data.rows).toHaveLength(45);
    expect(data.rows[44]).toEqual({no:'45',description:'B',amount:'1,234.56'});
    expect(data.address).toEqual(sample.address);expect(data.items).toEqual(sample.items);expect(data.totals).toEqual(sample.totals);
    expect(sample.rows).toHaveLength(1);
    expect(createScenario({address:sample.address,rows:sample.rows},'45-rows')).toEqual({address:sample.address,rows:sample.rows});
  });
  it('keeps numeric and string identities typed and all supplied amounts unchanged',()=> {
    const sample={items:[{no:1,description:'A',amount:100},{no:2,description:'B',amount:75}],totals:{subtotal:175,tax:6,grandTotal:181}};
    for (const scenario of ['empty','one','45-rows','100-rows','500-rows','long-text']) {
      const data=createScenario(sample,scenario);
      expect(data.totals).toEqual(sample.totals);
      data.items.forEach((row,index)=>{expect(typeof row.no).toBe('number');expect(row.amount).toBe(sample.items[index%2].amount);});
    }
  });
  it('requires a declaration for ambiguous table collections and honors a nested custom pointer',()=> {
    const project={manifest:{},sampleData:{first:[{no:1}],nested:{rows:[{no:'1'}]}},templateHtml:'<table class="prowitem" data-pf-each="/first"></table><table class="prowitem" data-pf-each="/nested/rows"></table>'};
    expect(()=>createProjectScenario(project,'45-rows')).toThrow(/Declare/);
    project.manifest.sampleScenarios={collection:'/nested/rows'};
    const data=createProjectScenario(project,'45-rows');
    expect(data.nested.rows).toHaveLength(45);expect(data.first).toEqual(project.sampleData.first);
  });
  it('does not invent rows for a fixture without an authoritative row shape',()=> {
    expect(createScenario({items:[],totals:{claimed:'0.00'}},'500-rows')).toEqual({items:[],totals:{claimed:'0.00'}});
  });
  it('keeps ProgressClaim stress schema-valid with string row identity and independent variations',()=> {
    const project=createProgressClaimProject(), original=structuredClone(project.sampleData);
    const template=document.createElement('template');template.innerHTML=project.templateHtml;
    for (const [scenario,count] of [['one',1],['45-rows',45],['100-rows',100],['500-rows',500],['long-text',6]]) {
      const data=createProjectScenario(project,scenario);
      expect(data.valuationRows).toHaveLength(count);
      expect(validateData(project.schema,data).errors).toEqual([]);
      const bound=bindTemplate(template,data,project.manifest);
      expect(bound.report.errors).toEqual([]);expect(bound.report.tableRows).toBe(count);
      expect(data.valuationRows.every(row=>typeof row.no==='string')).toBe(true);
      for (const key of ['variations','valuationTotal','variationTotal','contractSummary','claimSummary','settlement']) expect(data[key]).toEqual(original[key]);
    }
    const empty=createProjectScenario(project,'empty');
    expect(empty.valuationRows).toEqual([]);expect(empty.variations).toEqual(original.variations);
    expect(validateData(project.schema,empty).valid).toBe(false); // The fixture requires at least one valuation row.
    expect(project.sampleData).toEqual(original);
  });
  it('uses the fixture collection at the command consumer and restores its immutable source',async()=> {
    const project=createProgressClaimProject(),bus=new CommandBus(project);
    const first=await bus.execute('set_sample_scenario',{expectedRevision:0,scenario:'500-rows'});
    expect(first.ok).toBe(true);expect(bus.project.sampleData.valuationRows).toHaveLength(500);
    expect(bus.project.sampleData.valuationRows[499].no).toBe('500');
    const second=await bus.execute('set_sample_scenario',{expectedRevision:1,scenario:'one'});
    expect(second.ok).toBe(true);expect(bus.project.sampleData.valuationRows).toEqual([project.sampleData.valuationRows[0]]);
    expect(bus.project.sampleData.settlement).toEqual(project.sampleData.settlement);
    expect(bus.project.sampleData.variations).toEqual(project.sampleData.variations);
  });
});