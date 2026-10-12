import {staticProject} from './static-observation-fixture.js';
import {compileProject} from '../../studio-v3/model.js';

// Independent test rubric: expectations are not derived from the candidate or a model score.
export const FICTIONAL_RUBRIC=Object.freeze({id:'fictional-static-geometry-text/v1',pages:1,pageWidth:794,
  sections:Object.freeze(['header','footer']),texts:Object.freeze({'header-title':'FICTIONAL PIXEL CANARY','footer-note':'END OF FICTIONAL FORM'}),
  target:'footer-note',widthMin:700,widthMax:730,leftTolerance:2});
export const COMPARISON_DEFECTS=Object.freeze(['missing-section','wrong-text','width','alignment','pagination']);
export function comparisonFixture(defect) {
  const project=staticProject(),design=project.manifest.studioV3;
  if(defect==='missing-section')design.blocks.footer.enabled=false;
  else if(defect==='wrong-text')design.footer[0].text='DELIBERATELY WRONG FICTIONAL TEXT';
  else if(defect==='width')design.blocks.footer.layout={columns:2,gap:12};
  else if(defect==='alignment')design.footer[0].valueStyle={align:'right'};
  else if(defect==='pagination')design.blocks.footer.breakBefore=true;
  else if(defect!==undefined)throw new Error('Unknown fictional defect');
  return compileProject(project,design);
}
// Serialized into the actual preview frame by Playwright; no app measurement helper is reused.
export function observeComparisonDom(root) {
  const doc=root.ownerDocument || root;
  return {pages:[...doc.querySelectorAll('.printform_page')].map(page=> {
    const bounds=page.getBoundingClientRect();
    const nodes=[...page.querySelectorAll('[data-v3-id]')].filter(node=>!node.closest('[data-v3-selection]')).map(node=> {
      const r=node.getBoundingClientRect(),range=doc.createRange();range.selectNodeContents(node);const text=range.getBoundingClientRect();
      return {id:node.dataset.v3Id,text:node.textContent.replace(/\s+/g,' ').trim(),x:r.left-bounds.left,y:r.top-bounds.top,
        width:r.width,height:r.height,textX:text.left-bounds.left,textWidth:text.width};
    });
    return {width:bounds.width,height:bounds.height,nodes};
  })};
}
export function checkComparison(observed,rubric=FICTIONAL_RUBRIC) {
  const failures=[],add=(code,target)=>failures.push({code,...(target ? {target} : {})});
  const finite=value=>typeof value==='number' && Number.isFinite(value);
  if(!Array.isArray(observed?.pages) || !observed.pages.length || observed.pages.some(page=>!finite(page.width)||page.width<=0||!finite(page.height)||page.height<=0||
      !Array.isArray(page.nodes)||page.nodes.some(node=>typeof node.id!=='string'||typeof node.text!=='string'||
        !['x','y','width','height','textX','textWidth'].every(key=>finite(node[key])))))return {passed:false,rubric:rubric.id,failures:[{code:'OBSERVATION_INVALID'}]};
  if(observed.pages.length!==rubric.pages)add('PAGINATION');
  if(observed.pages.some(page=>Math.abs(page.width-rubric.pageWidth)>1))add('PAGE_WIDTH');
  const nodes=observed.pages.flatMap(page=>page.nodes);
  for(const id of rubric.sections)if(!nodes.some(node=>node.id===id && node.width>0 && node.height>0))add('MISSING_SECTION',id);
  for(const [id,expected] of Object.entries(rubric.texts)) {
    const matches=nodes.filter(node=>node.id===id);
    if(!matches.length || matches.some(node=>node.text!==expected))add('TEXT_MISMATCH',id);
  }
  const targets=nodes.filter(node=>node.id===rubric.target);
  if(!targets.length)add('MISSING_TARGET',rubric.target);
  for(const node of targets) {
    if(node.width<rubric.widthMin || node.width>rubric.widthMax)add('WIDTH',node.id);
    if(node.textWidth<=0 || Math.abs(node.textX-node.x)>rubric.leftTolerance)add('ALIGNMENT',node.id);
  }
  return {passed:failures.length===0,rubric:rubric.id,failures};
}
