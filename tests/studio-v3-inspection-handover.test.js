import { describe, expect, it } from 'vitest';
import { businessDemoInput } from '../studio-v3/business-document-demos.js';
import { normalizeBusinessDocument } from '../studio-v3/business-document-adapter.js';
import { createBusinessDocumentProject } from '../studio-v3/business-document-project.js';
import { saveProject, readProject } from '../studio-v3/file-io.js';
import { bindTemplate } from '../studio-v2/core/binding.js';
import { designOf } from '../studio-v3/model.js';
import { createDraft } from '../studio-v3/agent-draft.js';

function consume(kind) {
  const input = businessDemoInput(kind), original = structuredClone(input);
  const project = readProject(saveProject(createBusinessDocumentProject(input)));
  expect(input).toEqual(original);
  const template = document.createElement('template'); template.innerHTML = project.templateHtml;
  const bound = bindTemplate(template, project.sampleData, project.manifest);
  expect(bound.report.errors).toEqual([]);
  const values = id => [...bound.fragment.querySelectorAll(`[data-v3-id="${id}"]`)].map(node => node.textContent);
  return { input, project, values };
}

describe('independent inspection and asset handover source facts', () => {
  it('retains signed measurements without calculating conformance, limits or missing results', () => {
    const { input, project, values } = consume('InspectionReport');
    expect(project.sampleData.inspection).toEqual(input.inspection);
    expect(values('items-amount')).toEqual(['00012.500 mm', '-0000.125 mm', '']);
    expect(values('items-direction')).toEqual(['', '', 'Further review requested by source']);
    expect(values('customer-inspection-subject-lot')).toEqual(['000-LOT-A']);
    expect(values('customer-inspection-status-value')).toEqual([input.inspection.status.value]);
    expect(values('items-description')[0]).toContain(input.inspection.checks[0].expected);
    expect(values('items-trace')[1]).toContain(input.inspection.checks[1].measure.provenance.sourcePath);
    expect(project.sampleData.inspection.checks[0]).not.toHaveProperty('result');
    expect(project.sampleData.document).not.toHaveProperty('currency');
  });
  it('retains source asset identity, condition and optional quantity without inventing receipt or ownership', () => {
    const { input, project, values } = consume('AssetHandover');
    expect(project.sampleData.handover).toEqual(input.handover);
    expect(values('items-amount')).toEqual(['+0001.000 set', '']);
    expect(values('items-direction')).toEqual(['', '']);
    expect(values('items-description')[0]).toContain('000-SERIAL-A');
    expect(values('items-description')[0]).toContain(input.handover.assets[0].condition);
    expect(values('customer-handover-to-name')).toEqual([input.handover.to.name]);
    expect(project.sampleData.handover.assets[1]).not.toHaveProperty('quantity');
    expect(project.sampleData.handover).not.toHaveProperty('signature');
  });
  it.each(['InspectionReport','AssetHandover'])('%s refuses model substitution of every original source-context value', kind => {
    const { project } = consume(kind), before = structuredClone(project);
    for (const field of designOf(project).customer) {
      for (const patch of [{kind:'static',text:'Approved and signed'}, {pointer:'/document/number'}, {format:'number'}]) {
        expect(() => createDraft(project).apply('Invent source assertion',[{type:'set_field',target:`customer-${field.id}`,patch}])).toThrow('UNSAFE_PROPOSAL');
      }
    }
    expect(project).toEqual(before);
  });
  it('keeps omitted source workflow status absent rather than supplying acceptance', () => {
    for (const kind of ['InspectionReport','AssetHandover']) {
      const input = businessDemoInput(kind), branch = input.inspection || input.handover;
      delete branch.status;
      const normalized = normalizeBusinessDocument(input);
      expect(normalized.inspection || normalized.handover).not.toHaveProperty('status');
    }
  });
  it.each([
    ['InspectionReport', input => { input.inspection.checks[0].measure.amount = 12.5; }],
    ['InspectionReport', input => { input.inspection.checks[1].id = input.inspection.checks[0].id; }],
    ['InspectionReport', input => { input.inspection.checks[0].result = true; }],
    ['InspectionReport', input => { input.inspection.subject.provenance = {}; }],
    ['AssetHandover', input => { input.handover.assets[0].quantity.amount = '-0001.000'; }],
    ['AssetHandover', input => { input.handover.to.name = 123; }],
    ['AssetHandover', input => { input.handover.signature = 'fabricated'; }],
    ['AssetHandover', input => { input.document.currency = 'SGD'; }]
  ])('%s rejects ambiguous or invented source facts', (kind, change) => {
    const input = businessDemoInput(kind); change(input);
    expect(() => normalizeBusinessDocument(input)).toThrow();
  });
});
