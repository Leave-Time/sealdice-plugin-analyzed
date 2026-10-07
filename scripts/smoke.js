const assert = require('node:assert/strict');
const vm = require('node:vm');
const variables = new Map();
const storage = new Map();
const configs = new Map();
const replies = [];
let ext;
const KEY = '$manalyzed_achievement_state_v1';
const key = (ctx, name) => JSON.stringify([ctx.group?.groupId, ctx.player.userId, name]);
const get = (ctx, name, type) => {
  const value = variables.get(key(ctx, name));
  return [typeof value === type ? value : type === 'string' ? '' : 0, typeof value === type];
};
globalThis.seal = {
  ext: {
    find: () => ext,
    new: () => ({ cmdMap: {}, storageGet: (name) => storage.get(name) || '', storageSet: (name, value) => storage.set(name, value) }),
    register: (value) => { ext = value; },
    newCmdItemInfo: () => ({}), newCmdExecuteResult: (solved) => ({ solved }),
    unregisterConfig: () => {},
    registerStringConfig: (extension, name, value) => { if (!configs.has(name)) configs.set(name, value); },
    getStringConfig: (extension, name) => configs.get(name),
    registerOptionConfig: (extension, name, value) => { if (!configs.has(name)) configs.set(name, value); },
    getOptionConfig: (extension, name) => configs.get(name),
  },
  vars: {
    intGet: (ctx, name) => get(ctx, name, 'number'), strGet: (ctx, name) => get(ctx, name, 'string'),
    strSet: (ctx, name, value) => variables.set(key(ctx, name), value),
  },
  replyToSender: (ctx, msg, text) => replies.push(text),
};

async function main() {
  require('../dist/sealdice-js-ext.js');
  const ctx = { player: { userId: 'QQ:alice', name: 'Alice' }, group: { groupId: 'QQ-Group:1' } };
  const input = { source: 'example', id: 'first', name: '首次完成', description: '示例任务' };
  const hidden = { ...input, id: 'secret', name: '秘密条件', description: '不能泄漏的描述', hidden: true };
  const hook = globalThis.sealAchievements;
  hook.register(input);
  hook.register(hidden);
  assert.equal(hook.list(ctx).length, 2);
  assert.equal(hook.info(ctx, hidden.name), undefined);
  assert.deepEqual(hook.list(ctx)[1], { name: '隐藏成就', description: '解锁后揭晓', hidden: true, unlocked: false });
  globalThis.testCtx = ctx;
  globalThis.testAchievement = input;
  const result = vm.runInThisContext('globalThis.sealAchievements.record(testCtx, testAchievement)');
  delete globalThis.testCtx;
  delete globalThis.testAchievement;
  assert.equal(result.recorded, true);
  assert.equal(hook.record(ctx, input).recorded, false);
  assert.equal(replies.length, 0);
  assert.equal(hook.record(ctx, { ...input, source: 'other' }).total, 2);
  assert.throws(() => hook.info(ctx, input.name), /重复/);
  assert.equal(hook.info(ctx, 'example/first').unlocked, true);
  const bob = { ...ctx, player: { userId: 'QQ:bob', name: 'Bob' } };
  assert.equal(hook.list(bob).filter((item) => item.unlocked).length, 0);
  assert.throws(() => hook.record(ctx, { ...input, id: '' }));
  const originalSave = seal.vars.strSet;
  seal.vars.strSet = () => { throw new Error('write failed'); };
  assert.throws(() => hook.record(ctx, { ...input, id: 'failed' }));
  seal.vars.strSet = originalSave;
  assert.equal(JSON.parse(variables.get(key(ctx, KEY))).records.length, 2);

  const query = async (args) => {
    const parts = args.split(' ').filter(Boolean);
    const result = ext.cmdMap.achivements.solve(ctx, { sender: { nickname: 'Alice' } }, { args: parts, getArgN: (n) => parts[n - 1] || '' });
    await new Promise((resolve) => setImmediate(resolve));
    return result;
  };
  await query('list');
  assert.match(replies.pop(), /隐藏成就/);
  await query('info example/first');
  assert.match(replies.pop(), /已解锁：首次完成/);
  await query('info 秘密条件');
  assert.match(replies.pop(), /未找到/);
  assert.equal((await query('list -1')).showHelp, true);

  configs.set('成就渲染API', 'https://renderer.test/image');
  configs.set('成就渲染Token', 'test-token');
  let textModeRequests = 0;
  globalThis.fetch = async () => { textModeRequests++; throw new Error('文字模式不应调用 API'); };
  await query('list');
  assert.match(replies.pop(), /隐藏成就/, '配置 API 后文字模式仍使用文本');
  assert.equal(textModeRequests, 0, '文字模式不能发起渲染请求');
  configs.set('成就渲染方式', '图片');
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://renderer.test/image');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.ok(!options.body.includes(hidden.description));
    assert.ok(!options.body.includes(hidden.name));
    return { ok: true, json: async () => ({ imageUrl: 'https://renderer.test/result.png?a=1&b=2' }) };
  };
  await query('list');
  assert.match(replies.pop(), /^\[CQ:image,file=https:/);
  globalThis.fetch = async () => ({ ok: false, status: 500 });
  await query('list');
  assert.match(replies.pop(), /隐藏成就/);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ imageUrl: 'https://x/][CQ:at,qq=all]' }) });
  await query('list');
  assert.match(replies.pop(), /隐藏成就/);
  configs.set('成就渲染API', '');
  await query('list');
  assert.match(replies.pop(), /隐藏成就/, '图片模式缺少地址应回退为文字');
  hook.record(ctx, hidden);
  assert.equal(hook.info(ctx, hidden.name).unlocked, true);
  for (let i = 0; i < 10; i++) hook.register({ ...input, id: `item-${i}`, name: `成就${i}` });
  await query('list 2');
  assert.match(replies.pop(), /第 2\/2 页/);

  variables.set(key(ctx, '$m普通成功'), 3);
  variables.set(key(ctx, '$m大成功'), 1);
  variables.set(key(ctx, '$m失败'), 2);
  variables.set(key(ctx, '$m大失败'), -1);
  assert.equal(sealStats.getCount(ctx, 'criticalSuccess'), 1);
  assert.equal(sealStats.getSuccessCount(ctx), 4);
  assert.equal(sealStats.getFailureCount(ctx), 2);
  assert.equal(sealStats.getSuccessRate(ctx), 4 / 6);
  assert.equal(sealStats.getSuccessRate(bob), 0);
  assert.throws(() => sealStats.getCount(ctx, 'unknown'));

  const legacy = { ...ctx, player: { userId: 'QQ:legacy' } };
  variables.set(key(legacy, KEY), JSON.stringify({ version: 1, unlocks: [{ achievementId: 'checks-10', unlockedAt: 1 }] }));
  assert.equal(hook.record(legacy, input).total, 2);
  assert.equal(JSON.parse(variables.get(key(legacy, KEY))).records[0].unlockedAt, 1);
  const broken = { ...ctx, player: { userId: 'QQ:broken' } };
  for (const value of ['{invalid', JSON.stringify({ version: 99 }), 7]) {
    variables.set(key(broken, KEY), value);
    assert.throws(() => hook.record(broken, input));
    assert.equal(variables.get(key(broken, KEY)), value);
  }
  delete require.cache[require.resolve('../dist/sealdice-js-ext.js')];
  require('../dist/sealdice-js-ext.js');
  assert.equal(globalThis.sealAchievements.record(ctx, input).recorded, false);
  assert.ok(globalThis.sealAchievements.list(ctx).some((item) => item.name === '成就0'));
  console.log('SMOKE OK: 统计 API、成就登记/解锁、隐藏、查询、图片回退、迁移与重载通过');
}

main().catch((error) => { console.error(error); process.exit(1); });
