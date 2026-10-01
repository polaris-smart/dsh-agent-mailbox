import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MailboxMcpClient, scrubEnvironment } from '../src/mcp-client.ts';
import { apply } from '../src/plugin.ts';
import type { MailboxContext,MailboxToolDef } from '../src/types.ts';
const fake=`import readline from 'node:readline';
for await (const line of readline.createInterface({input:process.stdin})) {
 const req=JSON.parse(line);if(!req.id)continue;
 let result={};
 if(req.method==='tools/list') result={tools:[{name:'project_context',inputSchema:{type:'object',properties:{}}},{name:'project_message',inputSchema:{type:'object',properties:{body:{type:'string'}}}}]};
 if(req.method==='tools/call') {
  if(req.params.arguments.body==='hang')continue;
  result={content:[{type:'text',text:JSON.stringify({identity:process.argv.at(-1),credentialLeaked:Object.keys(process.env).some(k=>k==='MAILBOX_TEST_SECRET'||k==='DSH_TEST_CONTROL'),...req.params})}],isError:req.params.arguments.body==='deny'};
 }
 if(req.params?.arguments?.body==='protocol-secret') {process.stdout.write(JSON.stringify({id:req.id,error:{message:'NEVER-ECHO-PRIVATE-TOKEN'}})+'\\n');continue;}
 if(process.argv.at(-1)==='legacy' && req.method==='tools/list')result={tools:[{name:'mailbox_check',inputSchema:{type:'object'}}]};
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:req.id,result})+'\\n');
}`;
async function fixture() {
 const dir=await mkdtemp(join(tmpdir(),'mail-plugin-'));const script=join(dir,'fake.mjs');await writeFile(script,fake);
 return {dir,config:(sessionFile:string)=>({sessionFile,executable:process.execPath,executableArgs:[script]})};
}
test('real subprocess discovers tools, keeps instances separate, forwards request id',async()=>{
 const f=await fixture();const a=new MailboxMcpClient(f.config('alice'));const b=new MailboxMcpClient(f.config('bob'));
 try {
  assert.deepEqual((await a.listTools()).map(t=>t.name),['project_context','project_message']);
  const first=JSON.parse(await a.callTool('project_message',{request_id:'same',body:'hello'}));
  assert.equal(first.identity,'alice');assert.equal(first.arguments.request_id,'same');
  assert.equal(JSON.parse(await b.callTool('project_context',{})).identity,'bob');
  await assert.rejects(a.callTool('project_message',{body:'deny'}),/rejected/);
  await assert.rejects(a.callTool('project_message',{body:'protocol-secret'}),error=>{assert.ok(error instanceof Error);assert.ok(!error.message.includes('NEVER-ECHO'));return true;});
  assert.equal(JSON.parse(await a.callTool('project_message',{body:'你好🌟'})).arguments.body,'你好🌟');
  const abort=new AbortController();const waiting=a.callTool('project_message',{body:'hang'},abort.signal);setTimeout(()=>abort.abort(),10);
  await assert.rejects(waiting,/cancelled/);
 } finally {a.dispose();b.dispose();await rm(f.dir,{recursive:true,force:true});}
});
test('per-instance plugin lifecycle unregisters tools and preserves server schema',async()=>{
 const f=await fixture();const defs=new Map<string,MailboxToolDef>();let dispose=()=>{};
 const ctx={effect(fn:()=>()=>void){dispose=fn();},tools:{register(def:MailboxToolDef){defs.set(def.name,def);return()=>{defs.delete(def.name);};}}} as unknown as MailboxContext;
 try {
  await apply(ctx,f.config('one'));
  assert.equal(defs.size,2);assert.deepEqual(defs.get('project_message')?.parameters,{type:'object',properties:{body:{type:'string'}}});
  const out=await defs.get('project_context')!.execute({}, {signal:new AbortController().signal});assert.equal(JSON.parse(out).identity,'one');
  dispose();assert.equal(defs.size,0);
 } finally {dispose();await rm(f.dir,{recursive:true,force:true});}
});
test('missing executable fails safely without command or secret dump',async()=>{
 const client=new MailboxMcpClient({sessionFile:'secret-private-path',executable:'/nonexistent-executable',executableArgs:[]},1000);
 try {await assert.rejects(client.listTools(),/could not start/);}finally{client.dispose();}
});

test('legacy global MCP tools rejected with migration guidance',async()=>{
 const f=await fixture();const c=new MailboxMcpClient(f.config('legacy'));
 try{await assert.rejects(c.listTools(),/v0.8 project connection/);}finally{c.dispose();await rm(f.dir,{recursive:true,force:true});}
});

test('credential names excluded without reading their values',()=>{
 let reads=0;const env:NodeJS.ProcessEnv={PATH:'/safe/bin',LANG:'en_US.UTF-8',DSH_CONTROL:'do-not-pass'};
 for(const key of ['API_KEY','Password','SECRET','access_TOKEN'])Object.defineProperty(env,key,{enumerable:true,get(){reads++;throw new Error('credential value read');}});
 assert.deepEqual(scrubEnvironment(env),{PATH:'/safe/bin',LANG:'en_US.UTF-8'});assert.equal(reads,0);
});
test('real child process never receives ambient credentials or DSH controls',async()=>{
 const previousSecret=process.env.MAILBOX_TEST_SECRET;const previousDsh=process.env.DSH_TEST_CONTROL;
 process.env.MAILBOX_TEST_SECRET='fixture-only-placeholder';process.env.DSH_TEST_CONTROL='fixture-only-placeholder';
 const f=await fixture();const c=new MailboxMcpClient(f.config('scrub'));
 try {const out=JSON.parse(await c.callTool('project_context',{}));assert.equal(out.credentialLeaked,false);}
 finally{c.dispose();await rm(f.dir,{recursive:true,force:true});if(previousSecret===undefined)delete process.env.MAILBOX_TEST_SECRET;else process.env.MAILBOX_TEST_SECRET=previousSecret;if(previousDsh===undefined)delete process.env.DSH_TEST_CONTROL;else process.env.DSH_TEST_CONTROL=previousDsh;}
});

test('invalid spawn arguments never reveal private session paths',async()=>{
 const c=new MailboxMcpClient({sessionFile:'PRIVATE-PATH\0',executable:process.execPath,executableArgs:[]});
 try{await assert.rejects(c.listTools(),error=>{assert.ok(error instanceof Error);assert.match(error.message,/could not start/);assert.ok(!error.message.includes('PRIVATE-PATH'));return true;});}finally{c.dispose();}
});
