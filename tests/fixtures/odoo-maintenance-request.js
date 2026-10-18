import { readFileSync } from 'node:fs';
import { ODOO_MAINTENANCE_REQUEST_PROFILE, ODOO_MAINTENANCE_REQUEST_VERSION, ODOO_MAINTENANCE_REQUEST_REVISION } from '../../studio-v3/odoo-maintenance-request-adapter.js';

// Invented identities and native values; not a live Odoo receipt or authorization grant.
// Both repository test runners use the repository cwd; avoid browser asset URL rewriting.
export function fictionalOdooMaintenanceRequest() {
  return { profile: ODOO_MAINTENANCE_REQUEST_PROFILE,
    context: { odooVersion: ODOO_MAINTENANCE_REQUEST_VERSION, sourceRevision: ODOO_MAINTENANCE_REQUEST_REVISION,
      database: 'fictional-workshop-db', requestId: 417 },
    snapshotJson: readFileSync('tests/fixtures/odoo-maintenance-request.json', 'utf8') };
}
