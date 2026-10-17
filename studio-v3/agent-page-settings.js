import { pageSettings } from './paper-settings.js';

// Device/profile names are local literals, not printed labels or numeric layout facts.
// Neither ordinary context nor text-only form disclosure authorizes sending them.
export function agentPageSettings(design) {
  const page = pageSettings(design);
  if (page.printerProfile) delete page.printerProfile.name;
  return page;
}
