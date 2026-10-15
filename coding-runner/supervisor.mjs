import { spawn } from 'node:child_process';
import { constants } from 'node:os';

// This immutable PID1 never imports workspace code. Docker destroys its PID
// namespace on exit, including detached descendants holding inherited pipes.
const [mode, rawTimeout, command] = process.argv.slice(2);
const timeout = Number(rawTimeout);
if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 4200000 || !['run', 'helper', 'anchor'].includes(mode)) process.exit(125);
if (mode !== 'anchor' && timeout > 60000) process.exit(125);
process.on('SIGUSR1', () => {});
const deadline = setTimeout(() => process.exit(124), timeout);
if (mode !== 'anchor') {
  const executable = mode === 'run' ? '/bin/sh' : process.execPath;
  const args = mode === 'run' ? ['-c', command] : ['--disable-sigusr1', '/opt/printform/helper.mjs'];
  if (mode === 'run' && typeof command !== 'string') process.exit(125);
  const child = spawn(executable, args, { stdio: 'inherit' });
  let exiting = false;
  function finish(code) {
    if (exiting) return; exiting = true; clearTimeout(deadline);
    // Never await child 'close': a daemon can retain stdout forever.
    setTimeout(() => process.exit(code), 25);
  }
  child.once('error', () => finish(127));
  child.once('exit', (code, signal) => finish(code ?? Math.min(255, 128 + (constants.signals[signal] ?? 0))));
}
