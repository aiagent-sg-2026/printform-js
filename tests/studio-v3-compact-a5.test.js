import {it,expect} from 'vitest';
import {newProject,designOf} from '../studio-v3/model.js';
import {compactA5Record,newCompactA5Project} from '../studio-v3/compact-a5-demo.js';
import {validateDesign} from '../studio-v3/design-validation.js';
import {newDemoProject} from '../studio-v3/demo-templates.js';
import {starterRecords} from '../studio-v3/database-model.js';
const pointers=design=>['header','customer','totals','footer'].flatMap(section=>design[section].map(f=>f.pointer)).sort();
it('offers an explicit A5 preset without shrinking text or dropping any field/data',()=>{
 const before=newProject(),project=newCompactA5Project(),design=designOf(project),record=compactA5Record();
 expect(()=>validateDesign(design)).not.toThrow();expect(design.page).toEqual({paper:'A5',orientation:'landscape',margins:{top:12,right:12,bottom:12,left:12}});
 expect(design.font).toBe(9);expect(design.repeatHeader).toBe(false);expect(design.repeatTable).toBe(true);expect(pointers(design)).toEqual(pointers(designOf(before)));
 expect(project.sampleData).toEqual(record.data);expect(project.sampleData.items).toEqual(before.sampleData.items);expect(project.sampleData.summary.total).toBe(12150);
 expect(designOf(before).repeatHeader).toBe(true);expect(newDemoProject('CompactA5Invoice').manifest.studioV3).toEqual(design);
 expect(starterRecords().find(r=>r.id===record.id).data).toEqual(record.data);
});
