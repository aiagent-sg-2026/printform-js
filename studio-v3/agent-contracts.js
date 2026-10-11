import { Type } from '@earendil-works/pi-ai';
import { MAX_AUTHORING_OPERATIONS } from './ai-authoring-contract.js';
import { DEMO_CONFIG } from './ai-gateway-config.js';

// Executable contracts for the registered tools and operations. Examples are run through the real handlers by
// scripts/studio-v3-agent-conformance.mjs; a broken example or an undeclared result/error fails the build.
export const CONTRACT_VERSION = '1.0.0';
const open = properties => Type.Object(properties,{additionalProperties:true});
const closed = properties => Type.Object(properties,{additionalProperties:false});
const text = Type.String({minLength:1,maxLength:400});
const identity = open({release:Type.String()});
const list = Type.Array(open({}));
const ARGS = 'AGENT_ARGUMENTS_INVALID';
export const ANSWER_MAX = 4000;
const AUTHORING_ERRORS = [ARGS,'GRANT_DENIED','MALFORMED_PROPOSAL','AUTHORING_OPERATION_LIMIT','GLOBAL_FONT_PROPERTY_UNSUPPORTED','TABLE_SECTION_GRID_UNSUPPORTED','LOGO_ASSET_UNAVAILABLE','UNSAFE_PROPOSAL','UNSAFE_SCOPE','COLUMN_WIDTH_LIMIT','NO_CHANGES'];
const navy = {type:'set_style',patch:{color:'#163a65'}};
const prepared = [['apply_operations',{summary:'Navy accents',operations:[navy]}],['inspect_draft',{}]];

export const TOOL_CONTRACTS = Object.freeze({
  // 1.1.0 added the removed (tombstone) list and the ledger workflow summary; 1.2.0 adds run.profile (the effect grant).
  get_capabilities:{contractVersion:'1.2.0',outputSchema:closed({version:Type.Literal(1),identity,tools:list,operations:list,knowledge:list,run:open({mode:Type.String()}),
    commit:Type.String(),unsupported:Type.Array(Type.String()),errors:open({}),removed:list,
    workflows:closed({guide:Type.String(),humanMediated:Type.Integer(),notYetCallable:Type.Integer(),intentionallyUnavailable:Type.Integer()})}),errors:[ARGS],examples:[{args:{}}],invalid:[{args:{extra:true},error:ARGS}]},
  read_skill:{outputSchema:closed({id:Type.String(),description:Type.String(),sources:Type.Array(Type.String()),evaluations:Type.Array(Type.String()),content:Type.String({minLength:1}),identity}),
    errors:[ARGS,'AGENT_SKILL_UNAVAILABLE'],examples:[{args:{id:'form-authoring'}}],invalid:[{args:{id:'missing'},error:'AGENT_SKILL_UNAVAILABLE'},{args:{id:''},error:ARGS}]},
  get_context:{outputSchema:open({request:Type.String(),scope:open({mode:Type.String()}),authoring:open({}),run:open({mode:Type.String()})}),errors:[ARGS],examples:[{args:{}}],invalid:[{args:{id:1},error:ARGS}]},
  apply_operations:{outputSchema:text,errors:AUTHORING_ERRORS,limits:{maxOperations:MAX_AUTHORING_OPERATIONS},examples:[{args:{summary:'Navy accents',operations:[navy]}}],
    invalid:[{args:{summary:'Repeat',operations:[{type:'set_style',patch:{color:'#163a65'}}]},setup:prepared.slice(0,1),error:'NO_CHANGES'},{args:{summary:'Bad',operations:[{type:'set_style',patch:{font:'large'}}]},error:ARGS},
      {args:{summary:'Navy accents',operations:[navy]},grant:'read-only',error:'GRANT_DENIED'}]},
  inspect_draft:{outputSchema:Type.Union([closed({ready:Type.Boolean(),errors:Type.Array(Type.String()),issues:list,metrics:open({}),pages:list}),text]),
    errors:[ARGS,'TOOL_FAILED'],examples:[{args:{},setup:prepared.slice(0,1)}],invalid:[{args:{now:true},error:ARGS}]},
  undo_step:{outputSchema:text,errors:[ARGS,'GRANT_DENIED'],examples:[{args:{},setup:prepared.slice(0,1)},{args:{}}],invalid:[{args:{all:true},error:ARGS},{args:{},grant:'read-only',error:'GRANT_DENIED'}]},
  take_notes:{outputSchema:text,errors:[ARGS],limits:{maxNoteChars:DEMO_CONFIG.agent.maxNoteChars},examples:[{args:{notes:'Header uses navy.'}}],invalid:[{args:{notes:''},error:ARGS}]},
  finish:{outputSchema:text,errors:[ARGS,'GRANT_DENIED','NO_CHANGES','UNSAFE_PROPOSAL','TABLE_BACKGROUND_INTENT','AGENT_INSPECTION_REQUIRED','AGENT_INSPECTION_BLOCKED'],
    examples:[{args:{summary:'Navy accents'},setup:prepared}],invalid:[{args:{summary:'Navy'},setup:prepared.slice(0,1),error:'AGENT_INSPECTION_REQUIRED'},
      {args:{summary:'Nothing'},error:'NO_CHANGES'},{args:{summary:'Blocked'},setup:prepared,inspection:'blocked',error:'AGENT_INSPECTION_BLOCKED'},
      {args:{summary:'Navy accents'},grant:'read-only',error:'GRANT_DENIED'}]},
  finish_answer:{outputSchema:text,errors:[ARGS,'AGENT_EVIDENCE_REQUIRED'],limits:{maxAnswerChars:ANSWER_MAX},examples:[{args:{message:'The guide lists the tools for this release.'},setup:[['read_skill',{id:'form-authoring'}]],grant:'read-only'}],
    invalid:[{args:{message:'It is fine.'},error:'AGENT_EVIDENCE_REQUIRED'},{args:{message:''},error:ARGS}]},
  report_blocked:{outputSchema:text,errors:[ARGS],examples:[{args:{reason:'Asset import is not a tool in this release.'}}],invalid:[{args:{reason:''},error:ARGS}]}
});

// One accepted and one rejected example per operation, applied to a fresh blank project unless a fixture is named.
export const OPERATION_CONTRACTS = Object.freeze({
  set_element_style:{examples:[{operation:{type:'set_element_style',target:'header-title',patch:{bold:true}}}],invalid:[{operation:{type:'set_element_style',target:'header-title',patch:{fontSize:2}},error:ARGS}]},
  set_style:{examples:[{operation:navy}],invalid:[{operation:{type:'set_style',patch:{fontSize:12}},error:ARGS}]},
  set_table_style:{examples:[{operation:{type:'set_table_style',target:'items',patch:{rowBackground:'#f5f7fa'}}}],invalid:[{operation:{type:'set_table_style',target:'items',patch:{rowBackground:'blue'}},error:ARGS}]},
  set_field:{examples:[{operation:{type:'set_field',target:'footer-notes',patch:{label:'Terms'}}}],invalid:[{operation:{type:'set_field',target:'footer-missing',patch:{label:'Terms'}},error:'UNSAFE_PROPOSAL'}]},
  add_field:{examples:[{operation:{type:'add_field',section:'footer',field:{id:'thanks',kind:'static',text:'Thank you for your business.'}}}],
    invalid:[{operation:{type:'add_field',section:'footer',field:{id:'notes',kind:'static',text:'Duplicate'}},error:'UNSAFE_PROPOSAL'}]},
  remove_field:{examples:[{operation:{type:'remove_field',target:'footer-signature'}}],invalid:[{operation:{type:'remove_field',target:'label-footer-notes'},error:'UNSAFE_PROPOSAL'}]},
  reorder_fields:{examples:[{operation:{type:'reorder_fields',section:'footer',order:['footer-signature','footer-notes']}}],invalid:[{operation:{type:'reorder_fields',section:'footer',order:['footer-notes']},error:'UNSAFE_PROPOSAL'}]},
  set_section:{examples:[{operation:{type:'set_section',target:'footer',patch:{label:'Terms'}}}],invalid:[{operation:{type:'set_section',target:'items',patch:{layout:{columns:2}}},error:'TABLE_SECTION_GRID_UNSUPPORTED'}]},
  reorder_sections:{examples:[{operation:{type:'reorder_sections',order:['header','customer','items','footer','totals']}}],invalid:[{operation:{type:'reorder_sections',order:['header','customer','items','totals']},error:ARGS}]},
  set_page:{examples:[{operation:{type:'set_page',patch:{paper:'A5'}}}],invalid:[{operation:{type:'set_page',patch:{paper:'A3'}},error:ARGS}]},
  set_logo:{examples:[{operation:{type:'set_logo',value:null}}],invalid:[{operation:{type:'set_logo',value:{assetId:'missing-logo',width:80,height:40}},error:'LOGO_ASSET_UNAVAILABLE'}]},
  set_collection:{examples:[{operation:{type:'set_collection',value:'/lines'},request:'Use the /lines rows',fixture:'second-collection'}],invalid:[{operation:{type:'set_collection',value:'/missing'},error:'UNSAFE_PROPOSAL'}]},
  set_heading:{examples:[{operation:{type:'set_heading',value:'TAX INVOICE'}}],invalid:[{operation:{type:'set_heading',value:'x'.repeat(101)},error:ARGS}]}
});
