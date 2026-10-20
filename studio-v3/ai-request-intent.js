import { tableBackgroundIntents } from './table-background-intent.js';

// Host-only intent policy. Source/quoted instructions are not an authoring grant.
// Unclear wording narrows to read-only; this is not a semantic classifier or a permission source.
const EDIT = 'change|set|make|increase|reduce|adjust|add|remove|delete|move|reorder|resize|enable|disable|apply|amend|design|create|replace|align|bind|improve|enhance|tighten|enlarge|shrink|tidy|redesign|prepare|generate|draft|preview|use|build|rebuild|fix|repair|update|convert|implement|refactor|clear|restore|reset';
const ADDED_EDIT = '(?:give(?!\\s+(?:me|us)\\b)(?=\\s+(?:the|this|that|these|those|its|each|every|all)\\b[^.!?\\n]*?\\s(?:a|an)\\s+(?:[a-z]+\\s+){0,3}(?:background|colou?r|border|borders|style|font|weight|size|width|height|margin|margins|padding|spacing|shade|fill|tint|outline|underline|line|frame|look|heading|title|label|caption)\\b)(?![^.!?]*\\b(?:overview|summary|explanation|description|answer|list|breakdown|report|review|idea|ideas|suggestion|suggestions|example|examples|advice|feedback)\\b)|turn|rename|insert|hide|center|centre|widen|lighten|darken|tint|colour|color|bold|swap)(?!\\s+or\\b)';
const COMMAND_PREFIX = '^\\s*(?:please\\s+)?(?:(?:can|could|would|will)\\s+you\\s+(?:please\\s+)?|do\\s+)?';
const COMMAND = new RegExp(`${COMMAND_PREFIX}(?:${EDIT})\\b`,'i');
const ADDED_COMMAND = new RegExp(`${COMMAND_PREFIX}${ADDED_EDIT}\\b`,'i');
const RESPONSE_TARGET = /\b(?:your|the|an?)\s+(?:answer|explanation|analysis|assessment|response|reply|summary|review|report)\b|\bexplain(?:s|ed|ing)?\b|\b(?:in|into|as)\s+a\s+(?:list|table of values|bullet list)\b|\b(?:score|rating|jargon|tone|plain english)\b/i;
const QUESTION = /^\s*(?:please\s+)?(?:what\b|why\b|which\b|where\b|when\b|how\b|should\b|may\b|might\b|is\b|are\b|was\b|were\b|do\b|does\b|did\b|will\b|can\b|could\b|would\b|has\b|have\b|explain\b|describe\b|tell me (?:about|what|how|why|if|whether)\b|请问|为什么|多少|多大|怎么|如何|应该|能否|可否|请解释|解释一下|是否)/i;
const EXPLANATION = /^\s*(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?|do\s+)?(?:write|prepare|generate|make|create|give|provide|show)\s+(?:(?:me|us)\s+)?(?:an?\s+|the\s+)?(?:explanation|answer|description|instructions|summary)\b/i;
const FOCUS = /^(?:(?:please|only|just)\s+)+/i;
const PRESERVE_AND_EDIT = new RegExp(`^(?:keep|preserve|retain)\\b[^.!?\\n]*\\b(?:and|while)\\s+(?:${EDIT})\\b`,'i');
const PRESERVE_AND_ADDED_EDIT = new RegExp(`^(?:keep|preserve|retain)\\b[^.!?\\n]*\\b(?:and|while)\\s+${ADDED_EDIT}\\b`,'i');
const TABLE_COMMAND = /^(?:(?:the|this|selected|row|data|body|table|rows|cells|tbody|background|bg|fill|style)\b[\s:-]*)+(?:use|set|change|make|clear|reset|restore|to)\b/i;
const TABLE_CHINESE = /^(?:请|請)?(?:表格|表身|表体|表體|数据行|資料行)(?:背景|底色|填充|数据行|資料行)*(?:改成|改为|改為|变成|變成|换成|換成|设置为|設置為)/;
const TYPOGRAPHY = /^(?:(?:selected|this|the)\s+)*(?:label|heading|header|title|footer|font|text|table)(?:\s+(?:font|text|size|label|heading|title))?\s+(?:\d+(?:\.\d+)?\s*pt|bold|italic)(?:\s+(?:bold|italic|regular|normal))*[.!]?$/i;
function targetFirstCommand(text) {
  // Existing table intent supplies target/destination meaning, never permission on its own.
  if (/\b(?:not|never|don't|cannot|can't|no)\b|不要|不许|禁止|勿|是否|[吗嗎呢][？?]?$|怎么样|怎麼樣/i.test(text)) return false;
  if (TYPOGRAPHY.test(text)) return true;
  return (TABLE_COMMAND.test(text) || TABLE_CHINESE.test(text))
    && tableBackgroundIntents(text).some(intent=>!intent.ambiguous && (intent.color || intent.reset));
}
export function instructionText(request) {
  return String(request || '')
    .replace(/```[^]*?(?:```|$)|~~~[^]*?(?:~~~|$)/g,' ')
    .replace(/<([a-z][\w:-]*)\b[^>]*>[^]*?<\/\1\s*>/gi,' ')
    .replace(/^\s*>[^\n]*(?:\n|$)/gm,' ')
    .replace(/`[^`]*(?:`|$)|"[^"\n]*"|“[^”]*”|「[^」]*」|『[^』]*』|(?:^|\s)'[^'\n]*'(?=\s|$|[.,;!?])/g,' ')
    .replace(/(?:^|\n)\s*(?:source|reference|quoted text|attachment|源文|引用|参考资料)\s*[:：][^]*/i,' ')
    .trim();
}
export function requestIntent(request,{measuredQuestion=false}={}) {
  const text = instructionText(request);
  const restricted = /(?:^|[;,.!?\n；，。])\s*(?:please\s+)?(?:read(?:[\s-]+)?only\b|只[读讀]|唯[读讀])/i.test(text)
    || /^(?:please\s+)?(?:do not|don't|never)\s+(?:modify|edit|change|alter|create|generate|prepare|draft|preview)\b/i.test(text)
    || /\b(?:do not|don't|never)\s+(?:modify|edit|change|alter)\s+(?:anything|any content|the (?:live )?(?:form|document))\b/i.test(text)
    || /\b(?:do not|don't|never)\s+(?:create|generate|prepare|draft|preview)\b|\b(?:only|just)\s+(?:answer|explain|describe)\b/i.test(text)
    || /^(?:请|請)?(?:不要|勿|不许|禁止)(?:修改|更改|编辑|创建|生成|制作|预览|改动)|(?:不要|勿)(?:修改|改动)任何|仅(?:回答|解释)|只(?:回答|解释)/.test(text);
  if (restricted) return Object.freeze({kind:'question',reason:'explicit-read-only'});
  if (!text) return Object.freeze({kind:'ambiguous',reason:'no-direct-instruction'});
  const direct = text.replace(FOCUS,'');
  if (EXPLANATION.test(direct)) return Object.freeze({kind:'question',reason:'information-request'});
  // Direct polite commands are established authoring syntax; advice questions are not.
  const addedCommand = !/[?？]/.test(text) && !RESPONSE_TARGET.test(text) && (ADDED_COMMAND.test(direct) || PRESERVE_AND_ADDED_EDIT.test(direct));
  if (COMMAND.test(direct) || PRESERVE_AND_EDIT.test(direct) || addedCommand || /^(?:请|請)?(?:帮我|幫我)?(?:把.{1,60}(?:设置|設置|改为|改成)|修改|更改|调整|調整|设置|設置|增加|添加|删除|刪除|移动|移動|创建|建立|生成|设计|設計|制作|製作|预览|預覽)/.test(direct)
    || /^(?:不要只读|不要只讀)[，,]\s*(?:请|請)?(?:修改|更改|调整|調整)/.test(direct)) return Object.freeze({kind:'draft',reason:'direct-authoring-request'});
  if (measuredQuestion || QUESTION.test(direct)) return Object.freeze({kind:'question',reason:'information-request'});
  if (targetFirstCommand(direct)) return Object.freeze({kind:'draft',reason:'target-first-authoring-request'});
  return Object.freeze({kind:'ambiguous',reason:'no-explicit-authoring-request'});
}
