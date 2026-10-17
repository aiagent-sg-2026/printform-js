import { Type } from '@earendil-works/pi-ai';
import { BLOCKS, FIELD_KINDS, PAPERS, ORIENTATIONS, ALIGNMENTS, FORMATS } from './design-authoring.js';

const object = properties => Type.Object(properties,{additionalProperties:false});
const choice = values => Type.Union(values.map(value=>Type.Literal(value)));
const optional = properties => Object.fromEntries(Object.entries(properties).map(([key,value])=>[key,Type.Optional(value)]));
const color = Type.String({pattern:'^#[0-9a-fA-F]{6}$'});
const id = Type.String({minLength:1,maxLength:80});
const section = choice(BLOCKS);
const typography = object(optional({fontSize:Type.Number({minimum:6,maximum:72}),bold:Type.Boolean(),color,align:choice(ALIGNMENTS)}));
export const GLOBAL_STYLE_SCHEMA = object(optional({color,font:Type.Number({minimum:6,maximum:14}),padding:Type.Number({minimum:2,maximum:16}),
  ...Object.fromEntries(['striped','borders','repeatHeader','repeatTable','pageNumbers','breakBefore'].map(key=>[key,Type.Boolean()]))}));
const fieldProperties = {label:Type.String({maxLength:100}),kind:choice(FIELD_KINDS),pointer:Type.String({maxLength:240}),text:Type.String({maxLength:10000}),format:choice(FORMATS),
  showLabel:Type.Boolean(),labelStyle:typography,valueStyle:typography,
  width:Type.Number({minimum:1,maximum:400,description:'Primary items or existing additional-table columns:1..100 percent. Image fields:8..400 pixels. Omit on document static/bound/barcode fields; use section grids. Barcode moduleWidth/height belong to barcode settings.'}),
  assetId:Type.String({pattern:'^[a-z0-9-]{1,60}$'}),height:Type.Number({minimum:8,maximum:200}),fit:choice(['contain','cover']),
  barcode:object({format:choice(['CODE128','EAN13']),moduleWidth:Type.Integer({minimum:1,maximum:4}),height:Type.Integer({minimum:20,maximum:160}),displayValue:Type.Boolean()})};
const operation = (type,properties) => object({type:Type.Literal(type),...properties});
const customSizeMm = object({width:Type.Number({minimum:20,maximum:1000}),height:Type.Number({minimum:20,maximum:1000})});
const printerProfile = Type.Union([Type.Null(),object({
  version:Type.Literal(1),source:Type.Literal('user-supplied'),name:Type.String({minLength:1,maxLength:100}),
  ...optional(Object.fromEntries(['minWidthMm','maxWidthMm','minHeightMm','maxHeightMm'].map(key=>[key,Type.Number({minimum:1,maximum:2000})]))),
  orientations:Type.Optional(Type.Array(choice(ORIENTATIONS),{minItems:1,maxItems:2,uniqueItems:true})),
  nonPrintableMm:Type.Optional(object(optional(Object.fromEntries(['top','right','bottom','left'].map(key=>[key,Type.Number({minimum:0,maximum:100})]))))),
  dpi:Type.Optional(Type.Integer({minimum:72,maximum:9600})),cutter:Type.Optional(Type.Boolean())
})]);
// These transport schemas describe shapes/bounds. Dynamic binding, scope and final design invariants stay local.
export const OPERATION_SCHEMAS = Object.freeze({
  set_element_style:operation('set_element_style',{target:choice(['header-title','page-number']),patch:typography}),
  set_style:operation('set_style',{patch:GLOBAL_STYLE_SCHEMA}),
  set_table_style:operation('set_table_style',{target:Type.Literal('items'),patch:object({rowBackground:Type.Optional(Type.Union([color,Type.Null()]))})}),
  set_field:operation('set_field',{target:id,patch:object(optional(fieldProperties))}),
  add_field:operation('add_field',{section,field:object({id:Type.String({pattern:'^[a-z0-9-]{1,60}$'}),...optional(fieldProperties)})}),
  remove_field:operation('remove_field',{target:id}),
  reorder_fields:operation('reorder_fields',{section,order:Type.Array(id,{maxItems:30,uniqueItems:true})}),
  set_section:operation('set_section',{target:section,patch:object(optional({enabled:Type.Boolean(),label:Type.String({maxLength:100}),
    layout:object(optional({columns:Type.Integer({minimum:1,maximum:4}),gap:Type.Number({minimum:0,maximum:48})})),breakBefore:Type.Boolean(),keepTogether:Type.Boolean()}))}),
  reorder_sections:operation('reorder_sections',{order:Type.Array(section,{minItems:5,maxItems:5,uniqueItems:true})}),
  set_page:operation('set_page',{patch:object(optional({paper:choice(PAPERS),orientation:choice(ORIENTATIONS),customSizeMm,printerProfile,margins:object(optional(Object.fromEntries(['top','right','bottom','left'].map(key=>[key,Type.Number({minimum:0,maximum:72})]))))}))}),
  set_logo:operation('set_logo',{value:Type.Union([Type.Null(),object({assetId:fieldProperties.assetId,width:Type.Number({minimum:8,maximum:400}),height:fieldProperties.height,fit:Type.Optional(fieldProperties.fit)})])}),
  set_collection:operation('set_collection',{value:Type.String({minLength:1,maxLength:240})}),
  set_heading:operation('set_heading',{value:Type.String({maxLength:100,description:'Changes stored heading text only; does not enable header. A visible printed title also requires set_section target:"header" patch:{enabled:true}, only when scope permits. Preserve intentionally hidden headings.'})})
});
export const AUTHORING_TYPES = Object.freeze(Object.keys(OPERATION_SCHEMAS));
