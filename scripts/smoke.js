const assert = require('node:assert/strict');
const vm = require('node:vm');
const registered = [];
const variables = new Map();
const replies = [];
const key = '$manalyzed_achievement_state_v1';
const varKey = (ctx, name) => JSON.stringify([ctx.group?.groupId || '', ctx.player.userId, name]);
const get = (ctx, name, type) => {
  const value = variables.get(varKey(ctx, name));
  return [typeof value === type ? value : type === 'string' ? '' : 0, typeof value === type];
};
globalThis.seal = {
  ext: {
    find: () => registered[0],
    new: (name) => ({ name, cmdMap: {} }),
    register: (ext) => registered.push(ext),
    newCmdItemInfo: () => ({}),
    newCmdExecuteResult: (solved) => ({ solved }),
    unregisterConfig: () => {},
  },
  vars: {
    intGet: (ctx, name) => get(ctx, name, 'number'),
    strGet: (ctx, name) => get(ctx, name, 'string'),
    strSet: (ctx, name, value) => variables.set(varKey(ctx, name), value),
  },
  replyToSender: (ctx, msg, text) => replies.push(text),
};

try {
  require('../dist/sealdice-js-ext.js');
  const hook = globalThis.sealAchievements;
  assert.equal(hook.version, 1);
  assert.deepEqual(Object.keys(registered[0].cmdMap), ['achivements']);
  for (const event of ['onMessageReceived', 'onMessageSend', 'onCommandReceived']) {
    assert.equal(registered[0][event], undefined);
  }
  const ctx = { player: { userId: 'QQ:alice', name: 'Alice' }, group: { groupId: 'QQ-Group:1' } };
  const input = { source: 'example', id: 'first', name: '首次完成', description: '示例任务' };
  globalThis.__achievementTestCtx = ctx;
  globalThis.__achievementTestInput = input;
  const result = vm.runInThisContext('globalThis.sealAchievements.record(__achievementTestCtx, __achievementTestInput)');
  delete globalThis.__achievementTestCtx;
  delete globalThis.__achievementTestInput;
  assert.equal(result.recorded, true);
  assert.equal(replies.length, 0, 'hook 只记录，不发通知');
  result.achievement.name = '修改返回对象';
  assert.equal(globalThis.sealAchievements.record(ctx, input).achievement.name, input.name);
  assert.equal(globalThis.sealAchievements.record(ctx, input).recorded, false);
  assert.equal(globalThis.sealAchievements.record(ctx, { ...input, source: 'other' }).total, 2);
  const bob = { ...ctx, player: { userId: 'QQ:bob', name: 'Bob' } };
  assert.equal(globalThis.sealAchievements.record(bob, input).total, 1);
  assert.throws(() => globalThis.sealAchievements.record(ctx, { ...input, id: '' }));
  const originalSave = seal.vars.strSet;
  seal.vars.strSet = () => { throw new Error('write failed'); };
  assert.throws(() => globalThis.sealAchievements.record(ctx, { ...input, id: 'failed' }));
  seal.vars.strSet = originalSave;
  assert.equal(JSON.parse(variables.get(varKey(ctx, key))).records.length, 2);

  const cmd = registered[0].cmdMap.achivements;
  const query = (page = '') => cmd.solve(ctx, { sender: { nickname: 'Alice' } }, { getArgN: () => page });
  query();
  assert.match(replies.pop(), /已完成：2 项/);
  for (let i = 0; i < 10; i++) globalThis.sealAchievements.record(ctx, { ...input, id: `item-${i}` });
  query('2');
  assert.match(replies.pop(), /第 2\/2 页/);
  query('3');
  assert.match(replies.pop(), /页码超出/);
  assert.equal(query('-1').showHelp, true);

  const legacy = { ...ctx, player: { userId: 'QQ:legacy' } };
  variables.set(varKey(legacy, key), JSON.stringify({ version: 1, unlocks: [{ achievementId: 'checks-10', unlockedAt: 1 }] }));
  assert.equal(globalThis.sealAchievements.record(legacy, input).total, 2);
  const migrated = JSON.parse(variables.get(varKey(legacy, key)));
  assert.equal(migrated.version, 2);
  assert.equal(migrated.records[0].name, '初试身手');
  assert.equal(migrated.records[0].unlockedAt, 1);

  const broken = { ...ctx, player: { userId: 'QQ:broken' } };
  for (const value of ['{invalid', JSON.stringify({ version: 99 }), 7,
    JSON.stringify({ version: 2, records: [{ ...input, unlockedAt: 1 }, { ...input, unlockedAt: 2 }] })]) {
    variables.set(varKey(broken, key), value);
    assert.throws(() => globalThis.sealAchievements.record(broken, input));
    assert.equal(variables.get(varKey(broken, key)), value);
  }
  delete require.cache[require.resolve('../dist/sealdice-js-ext.js')];
  require('../dist/sealdice-js-ext.js');
  assert.equal(globalThis.sealAchievements.record(ctx, input).recorded, false);
  console.log('SMOKE OK: hook 登记、去重、玩家隔离、分页、迁移、异常保护及重载通过');
} catch (error) {
  console.error(error);
  process.exit(1);
}
