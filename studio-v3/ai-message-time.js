const formatter = new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'});
export function formatMessageTime(at) { return Number.isSafeInteger(at) && at >= 0 && at <= 8640000000000000 ? formatter.format(at) : ''; }
