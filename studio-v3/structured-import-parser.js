import { assertJsonBytes, assertJsonStructure, unsafeJsonKey } from './json-safety.js';
import { encodePointerToken as encodeKey } from '../studio-v2/core/json.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(message); };
const limits = {label:'Import',maxDepth:16,maxNodes:50000};

// Numeric JSON lexemes remain text until the user explicitly requests Number.
// A native JSON.parse would irreversibly round large IDs and erase decimal spelling.
export function parseLosslessRecords(text) {
  assertJsonBytes(text,limits);
  let position = 0, nodes = 0;
  const numberToken = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  const space = () => { while (/[\t\n\r ]/.test(text[position] || '\0')) position++; };
  const string = () => {
    const start = position++;
    while (position < text.length) {
      const char = text[position++];
      if (char === '\\') position++;
      else if (char === '"') return JSON.parse(text.slice(start,position));
    }
    fail('Unterminated JSON string.');
  };
  const value = depth => {
    if (++nodes > 50000 || depth > 16) fail('Import structure is too large or deeply nested.');
    space(); const char = text[position];
    if (char === '"') return string();
    if (char === '{' || char === '[') {
      position++; space(); const result = char === '{' ? {} : [], end = char === '{' ? '}' : ']';
      if (text[position] === end) { position++; return result; }
      while (position < text.length) {
        if (char === '{') {
          if (text[position] !== '"') fail('JSON object keys must be quoted.');
          const key = string();
          if (unsafeJsonKey(key)) fail('Prototype and constructor fields are not supported.');
          if (Object.hasOwn(result,key)) fail(`Duplicate JSON field: ${key}.`);
          space(); if (text[position++] !== ':') fail('Expected a JSON colon.');
          result[key] = value(depth+1);
        } else result.push(value(depth+1));
        space(); const separator = text[position++];
        if (separator === end) return result;
        if (separator !== ',') fail('Expected a JSON comma or closing bracket.');
        space();
      }
      fail('Unterminated JSON object or array.');
    }
    for (const [token,parsed] of [['true',true],['false',false],['null',null]]) {
      if (text.startsWith(token,position)) { position += token.length; return parsed; }
    }
    numberToken.lastIndex = position; const number = numberToken.exec(text);
    if (!number) fail(`Invalid JSON value at character ${position+1}.`);
    position += number[0].length; return number[0];
  };
  const result = value(0); space();
  if (position !== text.length) fail('Unexpected text after the JSON value.');
  return assertJsonStructure(result,limits);
}

export function parseCSV(text) {
  assertJsonBytes(text,limits);
  text = text.replace(/^\uFEFF/,'');
  const rows = []; let row = [], field = '', quoted = false, closed = false, started = false, cells = 0;
  const cell = () => {
    if (row.length >= 250) fail('At most 250 source fields are supported.');
    if (++cells > 50000) fail('Import structure is too large.');
    row.push(field); field = ''; closed = false; started = false;
  };
  const line = () => { cell(); rows.push(row); row = []; if (rows.length > 501) fail('CSV supports at most 500 records plus its header.'); };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index+1] === '"') { field += '"'; index++; }
        else { quoted = false; closed = true; }
      } else field += char;
    } else if (char === ',') cell();
    else if (char === '\r' || char === '\n') { if (char === '\r' && text[index+1] === '\n') index++; line(); }
    else if (char === '"') {
      if (started || closed) fail('CSV quotes must begin at the start of a field.');
      quoted = true; started = true;
    } else {
      if (closed) fail('Unexpected characters after a quoted CSV field.');
      field += char; started = true;
    }
  }
  if (quoted) fail('CSV has an unterminated quoted field.');
  if (row.length || field || started || closed) line();
  if (rows.length < 2) fail('CSV requires a header and at least one record.');
  const headers = rows.shift(), normalized = headers.map(key=>key.trim().normalize('NFC').toLowerCase());
  if (headers.length > 250) fail('At most 250 source fields are supported.');
  if (headers.some(key=>!key.trim() || unsafeJsonKey(key.trim()))) fail('CSV headers must be nonempty safe field names.');
  if (new Set(normalized).size !== headers.length) fail('CSV has ambiguous duplicate headers (ignoring case, surrounding spaces and Unicode normalization).');
  const result = rows.map((cells,index)=> {
    if (cells.length !== headers.length) fail(`CSV record ${index+1} has ${cells.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((key,column)=>[key,cells[column]]));
  });
  return assertJsonStructure(result,limits);
}

export function sourceFields(rows) {
  const fields = new Map();
  const visit = (value,path) => {
    if (Array.isArray(value)) return;
    if (object(value)) for (const [key,next] of Object.entries(value)) visit(next,`${path}/${encodeKey(key)}`);
    else fields.set(path,{pointer:path});
    if (fields.size > 250) fail('At most 250 scalar source fields are supported in one scope.');
  };
  rows.forEach(row=>visit(row,'')); return [...fields.values()];
}

export function parseStructuredImport(text,filename='') {
  const format = /\.csv$/i.test(filename) || (!/\.json$/i.test(filename) && !/^[\s\uFEFF]*[\[{]/.test(text)) ? 'csv' : 'json';
  const data = format === 'csv' ? parseCSV(text) : parseLosslessRecords(text.replace(/^\uFEFF/,''));
  if (!object(data) && !Array.isArray(data)) fail('Import a JSON record or an array of records.');
  const scopes = [];
  const add = (pointer,rows,label) => {
    if (rows.length > 500) return;
    scopes.push({pointer,rows,label,fields:sourceFields(rows)});
    if (scopes.length > 250) fail('At most 250 source scopes are supported.');
  };
  const visit = (value,path) => {
    if (Array.isArray(value)) {
      if (value.every(object)) add(path,value,`${path || '/ (root array)'} · ${value.length} records`);
      value.forEach((next,index)=>visit(next,`${path}/${index}`));
    } else if (object(value)) for (const [key,next] of Object.entries(value)) visit(next,`${path}/${encodeKey(key)}`);
  };
  if (object(data)) add('',[data],'/ (root record) · 1 record');
  visit(data,'');
  if (!scopes.length) fail('No collection of up to 500 object records is available.');
  return {format,filename:String(filename || `local.${format}`).slice(0,240),text,data,scopes};
}
