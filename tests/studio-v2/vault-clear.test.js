import {afterEach,describe,expect,it,vi} from 'vitest';
import {ByokVault} from '../../studio-v2/ui/agent-vault.js';

afterEach(()=>{vi.useRealTimers(); vi.unstubAllGlobals();});
describe('provider vault deletion lifecycle',()=>{
  it('waits for successful deletion after a transient browser blocked event',async()=>{
    const request={}; vi.stubGlobal('indexedDB',{deleteDatabase:()=>request});
    const vault=new ByokVault(); vault.db={close:vi.fn()};
    const connection=vault.db, deletion=vault.clear();
    request.onblocked?.(); request.onsuccess();
    await expect(deletion).resolves.toBeUndefined();
    expect(connection.close).toHaveBeenCalledOnce(); expect(vault.unlocked).toBe(false);
  });
  it('reports a genuinely blocked deletion within a bounded wait',async()=>{
    vi.useFakeTimers(); const request={}; vi.stubGlobal('indexedDB',{deleteDatabase:()=>request});
    const deletion=new ByokVault().clear(), rejected=expect(deletion).rejects.toThrow('while it is in use');
    request.onblocked?.(); await vi.advanceTimersByTimeAsync(5000); await rejected;
  });
});
