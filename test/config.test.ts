import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Config } from '../src/config.ts';
test('private session required and legacy identity config rejected', () => {
  assert.ok('issues' in Config['~standard'].validate({}));
  assert.ok('issues' in Config['~standard'].validate({agentId:'old',sessionFile:'/private/session.json'}));
  assert.ok('issues' in Config['~standard'].validate({sessionFile:'/private/session.json',executableArgs:'bad'}));
});
test('config holds only manifest path and fixed process arguments', () => {
  const result=Config['~standard'].validate({sessionFile:'/private/session.json'});
  assert.ok('value' in result);
  assert.deepEqual(result.value,{sessionFile:'/private/session.json',executable:'agent-mailbox',executableArgs:[]});
  const python=Config['~standard'].validate({sessionFile:'/private/session.json',executable:'/python',executableArgs:['-m','agent_mailbox']});
  assert.ok('value' in python);
  assert.deepEqual(python.value.executableArgs,['-m','agent_mailbox']);
});
