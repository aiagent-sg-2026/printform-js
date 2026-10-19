// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DockerBroker } from './docker.mjs';
import { LABEL } from './policy.mjs';

const own = '11111111-1111-4111-8111-111111111111';
const foreign = '22222222-2222-4222-8222-222222222222';
const workspace = '33333333-3333-4333-8333-333333333333';
const directories = [];
const originalPath = process.env.PATH;
afterEach(() => {
  process.env.PATH = originalPath;
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function labels(owner, expires = '0', managed = 'true') {
  return { [`${LABEL}.owner`]: owner, [`${LABEL}.expires`]: expires,
    [`${LABEL}.managed`]: managed, [`${LABEL}.workspace`]: workspace };
}
function fixture(swapOnReinspect = false) {
  const directory = mkdtempSync(join(tmpdir(), 'printform-docker-owner-'));
  directories.push(directory);
  const statePath = join(directory, 'state.json');
  const state = { resources: {}, inspections: {}, swapOnReinspect };
  for (const kind of ['container', 'volume']) {
    for (const [name, metadata] of Object.entries({
      expired: labels(own), foreign: labels(foreign), fresh: labels(own, '9999999999999'),
      unmanaged: labels(own, '0', 'false'), unknown: labels('')
    })) state.resources[`${kind}-${name}`] = { kind, labels: metadata };
  }
  writeFileSync(statePath, JSON.stringify(state));
  // Controlled resource store, not a Docker daemon. Ignore list filters deliberately:
  // ownership must still hold when candidates are stale or ownership changes before removal.
  writeFileSync(join(directory, 'docker'), `#!/usr/bin/env node
const fs = require('node:fs');
const path = ${JSON.stringify(statePath)}, state = JSON.parse(fs.readFileSync(path, 'utf8'));
const [kind, operation, ...args] = process.argv.slice(2);
if (operation === 'ls') console.log(Object.keys(state.resources).filter(name => state.resources[name].kind === kind).join('\\n'));
else if (operation === 'inspect') {
  const name = args[0], resource = state.resources[name];
  state.inspections[name] = (state.inspections[name] || 0) + 1;
  if (state.swapOnReinspect && name === 'container-expired' && state.inspections[name] === 2)
    resource.labels[${JSON.stringify(`${LABEL}.owner`)}] = ${JSON.stringify(foreign)};
  console.log(JSON.stringify([kind === 'volume' ? {Labels:resource.labels} : {Config:{Labels:resource.labels}}]));
} else if (operation === 'rm') delete state.resources[args.at(-1)];
else process.exitCode = 1;
fs.writeFileSync(path, JSON.stringify(state));
`, { mode: 0o700 });
  process.env.PATH = `${directory}:${originalPath}`;
  const broker = new DockerBroker('controlled-fixture', {}); broker.owner = own;
  return { broker, current: () => JSON.parse(readFileSync(statePath, 'utf8')).resources };
}

describe('broker-owned expired resource cleanup', () => {
  it('removes only its own expired managed resources, retaining foreign and active resources', async () => {
    const { broker, current } = fixture();
    await broker.cleanupExpired();
    const resources = current();
    for (const kind of ['container', 'volume']) {
      expect(resources[`${kind}-expired`]).toBeUndefined();
      expect(resources[`${kind}-foreign`].labels).toEqual(labels(foreign));
      expect(resources[`${kind}-fresh`].labels).toEqual(labels(own, '9999999999999'));
      expect(resources[`${kind}-unmanaged`].labels).toEqual(labels(own, '0', 'false'));
      expect(resources[`${kind}-unknown`].labels).toEqual(labels(''));
    }
  });
  it('refuses removal if the resource is replaced by a different owner before the final read', async () => {
    const { broker, current } = fixture(true);
    await expect(broker.cleanupExpired()).rejects.toMatchObject({ code: 'RESOURCE_OWNERSHIP' });
    expect(current()['container-expired'].labels).toEqual(labels(foreign));
    expect(current()['container-foreign'].labels).toEqual(labels(foreign));
    expect(current()['volume-expired'].labels).toEqual(labels(own));
  });
});
