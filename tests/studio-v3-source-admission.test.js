import { it,expect } from 'vitest';
import { pairSourceRunner } from '../studio-v3/source-workspace-client.js';
import { authorizeSourceWorkspace,isSourceAuthorization } from '../studio-v3/source-workspace-run.js';

it('keeps a known rejected missing-directory admission recoverable but quarantines an unknown server outcome',async()=> {
  const sourceHash='a'.repeat(64);let errorCode='DIRECTORY_NOT_FOUND',status=404;
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
  const connection=await pairSourceRunner('fictional-code-20261016',{transport:async url=> {
    if(url.endsWith('/v1/pair'))return json({protocol:'printform-coding-v1',profile:'local-docker-node24-source-json-v1',token:'fictional-source-token-for-protocol-unit',expiresAt:Date.now()+60000,runnerSourceHash:sourceHash,responseBytes:1048576});
    if(url.endsWith('/v1/workspaces'))return json({id:'admission-unit',revision:0,treeDigest:'b'.repeat(64),imageDigest:'sha256:'+'c'.repeat(64)});
    return json({error:{code:errorCode}},status);
  }});
  const workspace=authorizeSourceWorkspace(connection,{fictionalSource:true}),signal=new AbortController().signal;
  await workspace.open({identity:{release:'local',contractHash:'d',knowledgeHash:'e',packageHash:'f',sourceRunnerHash:sourceHash},project:{manifest:{documentId:'fictional-unit'}},baseRevision:0,runId:'fictional-unit'},signal);
  await expect(workspace.action('run',{command:'node --version',cwd:'missing'},signal)).rejects.toMatchObject({code:'WORKSPACE_PATH_DENIED',admissionRejected:true});
  expect(isSourceAuthorization(workspace)).toBe(true);
  errorCode='DOCKER_OPERATION_FAILED';status=503;
  await expect(workspace.action('run',{command:'node --version'},signal)).rejects.toMatchObject({code:'EFFECT_UNKNOWN'});
  expect(isSourceAuthorization(workspace)).toBe(false);expect(workspace.denialCode).toBe('EFFECT_UNKNOWN');
});
