// A narrow deterministic intent check supplements the model's explanation. It
// checks the resulting design, so an already-satisfied fill can accompany edits.
const colors = {
  yellow:'#ffff00', red:'#ff0000', blue:'#0000ff', green:'#008000', lime:'#00ff00',
  orange:'#ffa500', purple:'#800080', pink:'#ffc0cb', white:'#ffffff', black:'#000000',
  gray:'#808080', grey:'#808080', navy:'#000080', teal:'#008080', cyan:'#00ffff',
  aqua:'#00ffff', magenta:'#ff00ff', fuchsia:'#ff00ff', gold:'#ffd700',
  黄色:'#ffff00', 黃色:'#ffff00', 红色:'#ff0000', 紅色:'#ff0000', 蓝色:'#0000ff',
  藍色:'#0000ff', 绿色:'#008000', 綠色:'#008000', 白色:'#ffffff', 黑色:'#000000'
};
const colorPattern = new RegExp(`#[a-f0-9]{6}\\b|#[a-f0-9]{3}\\b|\\b(?:${Object.keys(colors).filter(k=>/^[a-z]+$/.test(k)).join('|')})\\b|${Object.keys(colors).filter(k=>!/^[a-z]+$/.test(k)).join('|')}`,'gi');
const table = /\b(?:table|rows?|cells?|tbody)\b|表格|表身|表体|数据行|資料行/i;
const background = /\b(?:background|bg|fill)\b|底色|背景|填充/i;
const otherTarget = /\b(?:headers?|headings?|titles?|labels?|fonts?|text|borders?|accents?)\b|表头|表頭|文字|字体|字體|边框|邊框/i;
const reset = /\b(?:clear|remove|reset|restore|transparent)\b|清除|移除|还原|還原|恢复|恢復|透明/i;
const defaults = /\bdefault\b|默认|預設/i;
const destination = /\b(?:to|into)\b|->|→|改成|改为|改為|变成|變成|换成|換成|变为|變為|到/gi;
const modifiedColor = /\b(?:light|dark|pale|soft|warm|cool|bright|muted)\s+(?:yellow|red|blue|green|orange|purple|pink|gray|grey)\b|[浅深淡淺](?:黄|黃|红|紅|蓝|藍|绿|綠)色/i;
const normalize = color => color.startsWith('#') ? color.length === 4 ? '#'+[...color.slice(1)].map(c=>c+c).join('') : color : colors[color];

function intentClauses(request) {
  return String(request).split(/[;,.!?\n，。；！？]|\band\b|\bbut\b|以及/i).flatMap(clause=>{
    const parts = clause.split(/(\b(?:with|while|plus)\b|同时|同時|并且|並且)/i), clauses = [parts[0]];
    for (let i=1;i<parts.length;i+=2) {
      const next = parts[i+1] || '';
      // A new named target starts its own instruction, in either target order.
      // “Replace blue with yellow” retains its destination in the same clause.
      if (table.test(next) || otherTarget.test(next)) clauses.push(next);
      else clauses[clauses.length-1] += parts[i]+next;
    }
    return clauses;
  });
}
function requestedColor(clause,anchor) {
  let matches = [...clause.matchAll(colorPattern)], directed = false;
  // Prefer the destination in “from blue to yellow”, including arrows/Chinese.
  // Only a direction with an actual color after it narrows the candidate set.
  for (const marker of clause.matchAll(destination)) {
    const after = matches.filter(match=>match.index > marker.index);
    if (after.length) { matches = after; directed = true; }
  }
  if (/\breplace\b|替换|替換/i.test(clause)) {
    const withColor = /\bwith\b/i.exec(clause);
    const after = withColor && matches.filter(match=>match.index > withColor.index);
    if (after?.length) { matches = after; directed = true; }
  }
  // A precise user hex refines a broad color-family word, e.g. red (#a82938).
  const exact = matches.filter(match=>match[0].startsWith('#'));
  const choices = exact.length ? exact : matches;
  choices.sort((a,b)=>Math.abs(a.index-anchor)-Math.abs(b.index-anchor));
  const ambiguous = new Set(choices.map(match=>normalize(match[0].toLowerCase()))).size > 1;
  return {directed,ambiguous,hasColor:Boolean(matches.length),color:!exact.length && modifiedColor.test(clause) ? null : choices[0] ? normalize(choices[0][0].toLowerCase()) : null};
}
export function tableBackgroundIntents(request) {
  return intentClauses(request).flatMap(clause=>{
    const target = table.exec(clause), fill = background.exec(clause);
    if (!target) return [];
    const desired = requestedColor(clause,fill?.index ?? target.index);
    // Row text, header and border requests must not be mistaken for a body fill.
    if (otherTarget.test(clause.slice(0,fill?.index ?? clause.length))) return [];
    if (!fill && (!desired.hasColor || otherTarget.test(clause))) return [];
    return [{ambiguous:desired.ambiguous,reset:!desired.directed && (reset.test(clause) || (!desired.hasColor && defaults.test(clause))),color:desired.color}];
  });
}

export function missesTableBackgroundIntent(request, design, diff, references=[]) {
  const actual = design.tableStyle?.rowBackground?.toLowerCase();
  // Element comments are already validated by the composer. Their text only
  // tightens this acceptance check; it never grants scope or authoring authority.
  const texts = [request,...references.map(r=>r.id === 'items' ? `Table rows: ${r.comment || ''}` : r.comment || '')];
  return texts.flatMap(tableBackgroundIntents).some(intent=>{
    if (intent.ambiguous) return true;
    if (intent.reset) return Boolean(actual);
    if (intent.color) return actual !== intent.color;
    // For unspecified/custom shades, demand a real body-fill edit, not a claim
    // paired with unrelated padding, striping, accent or typography changes.
    return !actual || !diff.some(d=>d.target === 'items' && d.property === 'tableStyle.rowBackground');
  });
}
