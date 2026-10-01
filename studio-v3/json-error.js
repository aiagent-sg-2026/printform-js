function errorPosition(source) {
  let index = 0;
  const fail = () => { throw index; };
  const space = () => { while (/[\t\n\r ]/.test(source[index] || '\u0000')) index++; };
  const string = () => {
    if (source[index++] !== '"') { index--; fail(); }
    while (index < source.length) {
      const char = source[index++]; if (char === '"') return;
      if (char.charCodeAt(0) < 32) { index--; fail(); }
      if (char === '\\') {
        const escape = source[index++];
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(source.slice(index,index+4))) fail(); index += 4;
        } else if (!['"','\\','/','b','f','n','r','t'].includes(escape)) { index--; fail(); }
      }
    }
    fail();
  };
  const value = depth => {
    space(); if (depth > 128) fail();
    if (source[index] === '"') return string();
    if (source[index] === '{' || source[index] === '[') {
      const object = source[index++] === '{', close = object ? '}' : ']'; space();
      if (source[index] === close) { index++; return; }
      while (index < source.length) {
        if (object) { string(); space(); if (source[index++] !== ':') { index--; fail(); } }
        value(depth+1); space();
        if (source[index] === close) { index++; return; }
        if (source[index++] !== ',') { index--; fail(); } space();
      }
      fail();
    }
    const token = source.slice(index).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
    if (!token) fail(); index += token[0].length;
  };
  try { value(0); space(); if (index < source.length) fail(); } catch (position) { return Number.isInteger(position) ? position : index; }
  return index;
}
export function parseSampleJSON(source) {
  try { return JSON.parse(source); } catch (error) {
    const position = errorPosition(source), before = source.slice(0,position);
    const line = before.split('\n').length, column = position-before.lastIndexOf('\n');
    throw Object.assign(new Error(`Invalid JSON at line ${line}, column ${column}. ${error.message}`),{code:'INVALID_JSON',line,column});
  }
}
