import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { LABEL, BASE_IMAGE, PROTOCOL, check, fail, RunnerError } from './policy.mjs';
import { runnerSourceHash } from './identity.mjs';

function cli(args, { input, max = 131072, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { env: { PATH: process.env.PATH, HOME: process.env.HOME }, stdio: ['pipe', 'pipe', 'pipe'] });
    const output = { stdout: [], stderr: [], stdoutBytes: 0, stderrBytes: 0, truncated: false };
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout); timer.unref();
    for (const stream of ['stdout', 'stderr']) child[stream].on('data', (chunk) => {
      const remaining = max - output.stdoutBytes - output.stderrBytes;
      if (remaining > 0) output[stream].push(chunk.subarray(0, remaining));
      output[`${stream}Bytes`] += chunk.length; if (chunk.length > remaining) output.truncated = true;
    });
    child.on('error', () => { clearTimeout(timer); reject(new RunnerError('DOCKER_UNAVAILABLE', 503)); });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      if (timedOut) return reject(new RunnerError('DOCKER_TIMEOUT', 503));
      resolve({ exitCode, signal, stdout: Buffer.concat(output.stdout).toString('utf8'), stderr: Buffer.concat(output.stderr).toString('utf8'), truncated: output.truncated });
    });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
async function success(args, options) {
  const result = await cli(args, options); check(result.exitCode === 0 && !result.truncated, 'DOCKER_OPERATION_FAILED', 503); return result.stdout.trim();
}
export class DockerBroker {
  constructor(image, limits) { this.reference = image; this.limits = limits; this.owner = randomUUID(); this.imageDigest = null; }
  async initialize() {
    check(typeof this.reference === 'string' && this.reference.length <= 256 && /^[a-zA-Z0-9][a-zA-Z0-9._/@:-]*$/.test(this.reference), 'INVALID_IMAGE');
    let image;
    try { image = JSON.parse(await success(['image', 'inspect', this.reference])); } catch { fail('IMAGE_UNAVAILABLE', 503); }
    check(Array.isArray(image) && image.length === 1 && /^sha256:[a-f0-9]{64}$/.test(image[0].Id), 'INVALID_IMAGE');
    const labels = image[0].Config?.Labels;
    check(labels?.[`${LABEL}.protocol`] === PROTOCOL && labels?.[`${LABEL}.base`] === BASE_IMAGE.split('@')[1], 'UNSEALED_IMAGE');
    this.imageDigest = image[0].Id; await this.verifySourceIdentity(); await this.cleanupExpired();
  }
  async verifySourceIdentity() {
    const name = `pf-identity-${randomUUID()}`, resource = { id: randomUUID() };
    try {
      const hostHash = runnerSourceHash();
      await success([...this.runtime(resource, name), this.imageDigest, 'node', '--disable-sigusr1', '/opt/printform/identity.mjs']);
      const output = await success(['container', 'start', '--attach', name]);
      let identity; try { identity = JSON.parse(output); } catch { fail('RUNNER_SOURCE_MISMATCH', 409); }
      check(identity.runnerSourceHash === hostHash, 'RUNNER_SOURCE_MISMATCH', 409); this.runnerSourceHash = hostHash;
    } finally { await this.remove('container', name); }
  }
  labels(workspace) {
    return [`${LABEL}.managed=true`, `${LABEL}.owner=${this.owner}`, `${LABEL}.workspace=${workspace.id}`,
      `${LABEL}.expires=${Date.now() + this.limits.tokenMs + this.limits.idleMs}`];
  }
  async inspect(kind, name) {
    const result = await cli([kind, 'inspect', name], { max: 1048576 });
    if (result.exitCode !== 0) {
      if (result.exitCode === 1 && /No such (container|volume|object):/.test(result.stderr) && result.stderr.includes(name)) return null;
      fail('DOCKER_OPERATION_FAILED', 503);
    }
    check(!result.truncated, 'DOCKER_OPERATION_FAILED', 503);
    try {
      const resources = JSON.parse(result.stdout); check(Array.isArray(resources) && resources.length === 1, 'DOCKER_OPERATION_FAILED', 503); return resources[0];
    } catch { fail('DOCKER_OPERATION_FAILED', 503); }
  }
  async remove(kind, name) {
    const resource = await this.inspect(kind, name); if (!resource) return;
    const labels = kind === 'volume' ? resource.Labels : resource.Config?.Labels;
    check(labels?.[`${LABEL}.managed`] === 'true' && labels?.[`${LABEL}.owner`] === this.owner, 'RESOURCE_OWNERSHIP', 403);
    await success(kind === 'volume' ? ['volume', 'rm', name] : ['container', 'rm', '--force', name]);
  }
  async cleanupExpired() {
    for (const kind of ['container', 'volume']) {
      const names = await success([kind, 'ls', ...(kind === 'container' ? ['--all'] : []), '--quiet', '--filter', `label=${LABEL}.managed=true`, '--filter', `label=${LABEL}.owner=${this.owner}`]);
      for (const name of names.split('\n').filter(Boolean)) {
        const resource = await this.inspect(kind, name); const labels = kind === 'volume' ? resource?.Labels : resource?.Config?.Labels;
        if (labels?.[`${LABEL}.managed`] !== 'true' || labels[`${LABEL}.owner`] !== this.owner || !/^[0-9]+$/.test(labels[`${LABEL}.expires`] ?? '') || Number(labels[`${LABEL}.expires`]) >= Date.now()) continue;
        check(/^[0-9a-f-]{36}$/.test(labels[`${LABEL}.owner`] ?? '') && /^[0-9a-f-]{36}$/.test(labels[`${LABEL}.workspace`] ?? ''), 'RESOURCE_OWNERSHIP', 403);
        await this.remove(kind, name);
      }
    }
  }
  runtime(workspace, name) {
    return ['container', 'create', '--name', name, ...this.labels(workspace).flatMap((label) => ['--label', label]),
      '--read-only', '--user', '1000:1000', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges=true',
      '--network', 'none', '--ipc', 'none', '--memory', '512m', '--memory-swap', '512m', '--cpus', '2', '--pids-limit', '64',
      '--ulimit', 'fsize=8388608:8388608', '--ulimit', 'nofile=256:256', '--log-driver', 'local', '--log-opt', 'max-size=1m', '--log-opt', 'max-file=1', '--log-opt', 'compress=false',
      '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=16777216,mode=1777',
      ...(workspace.volume ? ['--mount', `type=volume,source=${workspace.volume},target=/workspace,volume-nocopy`] : [])];
  }
  async createWorkspace(workspace, files) {
    workspace.volume = `pf-coding-${this.owner}-${workspace.id}`; workspace.anchor = `pf-anchor-${workspace.id}`;
    try {
      await success(['volume', 'create', '--driver', 'local', '--opt', 'type=tmpfs', '--opt', 'device=tmpfs',
        '--opt', 'o=size=12582912,nr_inodes=1024,uid=1000,gid=1000,mode=0700',
        ...this.labels(workspace).flatMap((label) => ['--label', label]), workspace.volume]);
      await success([...this.runtime(workspace, workspace.anchor), this.imageDigest, 'node', '--disable-sigusr1', '/opt/printform/supervisor.mjs', 'anchor', String(this.limits.tokenMs + this.limits.idleMs)]);
      await success(['container', 'start', workspace.anchor]);
      return await this.helper(workspace, 'initialize', { files });
    } catch (error) { await this.destroy(workspace).catch(() => {}); throw error; }
  }
  async helper(workspace, operation, args = {}) {
    const name = `pf-helper-${randomUUID()}`;
    try {
      await success([...this.runtime(workspace, name), '--interactive', '--workdir', '/workspace', this.imageDigest, 'node', '--disable-sigusr1',
        '/opt/printform/supervisor.mjs', 'helper', operation === 'search' ? '3000' : '20000']);
      const result = await cli(['container', 'start', '--attach', '--interactive', name], {
        input: JSON.stringify({ operation, args, limits: this.limits }), max: 27000000, timeout: operation === 'search' ? 5000 : 30000 });
      check(!result.truncated, 'HELPER_OUTPUT_LIMIT', 503);
      let response;
      try { response = JSON.parse(result.stdout); } catch { fail(operation === 'search' && result.exitCode === 124 ? 'SEARCH_TIMEOUT' : 'HELPER_FAILED', 503); }
      if (!response.ok) throw new RunnerError(response.error?.code ?? 'HELPER_FAILED', 409);
      check(result.exitCode === 0, 'HELPER_FAILED', 503); return response.result;
    } catch (error) {
      if (operation === 'search' && error.code === 'DOCKER_TIMEOUT') fail('SEARCH_TIMEOUT', 408);
      throw error;
    } finally { await this.remove('container', name); }
  }
  run(workspace, args) {
    const name = `pf-run-${randomUUID()}`;
    const job = { name, reason: null, started: false, finished: false, killSignal: null, promise: null, cancel: null }; let timer;
    job.cancel = async (reason = 'CANCELLED') => {
      job.reason ??= reason;
      if (job.started) {
        let resource = await this.inspect('container', name);
        // Only the brief start transition is sampled; HTTP wait uses the actual
        // completion promise. Never acknowledge cancellation before removal.
        const until = Date.now() + 30000;
        while (resource?.State.Status === 'created' && !job.finished && Date.now() < until) {
          await new Promise((resolve) => setTimeout(resolve, 25)); resource = await this.inspect('container', name);
        }
        if (!resource) return;
        check(resource?.Config?.Labels?.[`${LABEL}.owner`] === this.owner, 'RESOURCE_OWNERSHIP', 403);
        if (resource.State.Running) {
          const killed = await cli(['container', 'kill', '--signal', 'KILL', name]);
          if (killed.exitCode === 0) job.killSignal = 'SIGKILL';
          else check(!(await this.inspect('container', name))?.State.Running, 'CANCEL_FAILED', 503);
        }
      }
    };
    job.promise = (async () => {
      try {
        await success([...this.runtime(workspace, name), '--workdir', `/workspace/active${args.cwd ? `/${args.cwd}` : ''}`,
          ...Object.entries(args.env).flatMap(([key, value]) => ['--env', `${key}=${value}`]), this.imageDigest, 'node', '--disable-sigusr1',
          '/opt/printform/supervisor.mjs', 'run', String(args.timeoutMs), args.command]);
        if (job.reason) return { exitCode: null, signal: null, stdout: '', stderr: '', truncated: false, started: false, reason: job.reason };
        job.started = true;
        const completion = cli(['container', 'start', '--attach', name], { max: this.limits.outputBytes, timeout: args.timeoutMs + 30000 });
        if (job.reason) await job.cancel(job.reason);
        timer = setTimeout(() => { void job.cancel('COMMAND_TIMEOUT').catch(() => {}); }, args.timeoutMs); timer.unref();
        const output = await completion;
        const state = (await this.inspect('container', name))?.State;
        check(state && ['exited', 'dead'].includes(state.Status) && Date.parse(state.StartedAt) > 0 &&
          !state.Running && Number.isInteger(state.ExitCode), 'PROCESS_STATE_UNKNOWN', 503);
        return { ...output, exitCode: state.ExitCode, signal: job.killSignal,
          started: true, oomKilled: Boolean(state.OOMKilled), reason: job.reason,
          process: { exitCode: state.ExitCode, startedAt: state.StartedAt, finishedAt: state.FinishedAt, supervisor: true } };
      } finally { clearTimeout(timer); await this.remove('container', name); job.finished = true; }
    })();
    return job;
  }
  async destroy(workspace) {
    if (workspace.anchor) await this.remove('container', workspace.anchor);
    if (workspace.volume) await this.remove('volume', workspace.volume);
  }
}
