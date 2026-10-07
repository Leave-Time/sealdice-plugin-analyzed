/**
 * 加载冒烟测试：用 seal 桩（Proxy 兜底）在 Node 中直接加载打包产物，
 * 用于在无 SealDice 环境下提前发现加载期的 ReferenceError/TypeError。
 * 用法：npm run build && npm run smoke
 */
const noop = () => undefined;
const assert = require('node:assert/strict');

const registered = [];
const configs = new Map();
const variables = new Map();
const replies = [];
const stateKey = '$manalyzed_achievement_state_v1';
const variableKey = (ctx, key) => JSON.stringify([ctx.group.groupId, ctx.player.userId, key]);
const getVariable = (ctx, key, type) => {
  const value = variables.get(variableKey(ctx, key));
  return [typeof value === type ? value : type === 'number' ? 0 : '', typeof value === type];
};
const sendReply = (route, ctx, msg, text) => {
  // 模拟反馈发送也会再次进入发送回调。
  replies.push({ route, text });
  assert.ok(variables.has(variableKey(ctx, stateKey)), '发送反馈前必须先保存解锁状态');
  registered[0].onMessageSend(ctx, { ...msg, message: text, sender: { userId: 'QQ:bot' } }, '');
};

const sealStub = {
  ext: {
    find: () => undefined,
    new: (name, author, version) => ({
      name: name || '',
      author: author || '',
      version: version || '',
      cmdMap: {},
    }),
    register: (ext) => {
      registered.push(ext);
    },
    newCmdItemInfo: () => ({
      cmdMap: {},
      allowDelegate: true,
      solve: noop,
    }),
    newCmdExecuteResult: () => ({}),
    getCtxProxyFirst: (ctx) => ctx,
    registerBoolConfig: (ext, key, value) => configs.set(key, value),
    registerStringConfig: (ext, key, value) => configs.set(key, value),
    getBoolConfig: (ext, key) => configs.get(key),
    getStringConfig: (ext, key) => configs.get(key),
  },
  vars: {
    intGet: (ctx, key) => getVariable(ctx, key, 'number'),
    strGet: (ctx, key) => getVariable(ctx, key, 'string'),
    intSet: (ctx, key, value) => variables.set(variableKey(ctx, key), value),
    strSet: (ctx, key, value) => variables.set(variableKey(ctx, key), value),
  },
  format: (ctx, text) => String(text || ''),
  formatTmpl: (ctx, text) => String(text || ''),
  replyToSender: (ctx, msg, text) => sendReply('sender', ctx, msg, text),
  replyPerson: (ctx, msg, text) => sendReply('private', ctx, msg, text),
  replyGroup: noop,
  base64ToImage: (s) => s,
  getCtxProxyFirst: (c) => c,
};

// 兜底：访问任何未定义属性时返回 noop 函数
globalThis.seal = new Proxy(sealStub, {
  get(t, p) {
    return p in t ? t[p] : noop;
  },
  set(t, p, v) {
    t[p] = v;
    return true;
  },
});

try {
  require('../dist/sealdice-js-ext.js');

  const checks = {
    '扩展已通过 seal.ext.register 注册': registered.length > 0,
    '扩展名非空': registered.length > 0 && !!registered[0].name,
    '注册了至少一个指令': registered.length > 0 && Object.keys(registered[0].cmdMap || {}).length > 0,
  };
  const failedChecks = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  if (failedChecks.length > 0) {
    console.error('SMOKE FAIL:', failedChecks.join(', '));
    process.exit(1);
  }

  const ext = registered[0];
  const cmdNames = Object.keys(ext.cmdMap).join(', ');
  console.log(`SMOKE OK: 插件加载无异常，已注册扩展 <${ext.name}>，指令: ${cmdNames}`);

  const context = (id) => ({
    endPoint: { userId: 'QQ:bot' }, group: { groupId: 'QQ-Group:1' },
    player: { userId: `QQ:${id}`, name: id },
  });
  const message = (ctx) => ({ sender: { userId: ctx.player.userId, nickname: ctx.player.name }, message: '.ra 50' });
  const set = (ctx, key, value) => variables.set(variableKey(ctx, key), value);
  const complete = (ctx, command = 'ra', updates = {}, output = '检定完成') => {
    const msg = message(ctx);
    registered[0].onMessageReceived(ctx, msg);
    for (const [key, value] of Object.entries(updates)) set(ctx, key, value);
    if (output) registered[0].onMessageSend(ctx, { ...msg, message: output, sender: { userId: 'QQ:bot' } }, '');
    registered[0].onCommandReceived(ctx, msg, { command });
  };
  const alice = context('alice');
  set(alice, '$m普通成功', 9);
  complete(alice, 'ra', { '$m普通成功': 10 });
  assert.equal(replies.length, 1);
  assert.match(replies[0].text, /alice.*初试身手/);
  complete(alice, 'rc', { '$m普通成功': 11 });
  assert.equal(replies.length, 1, '已解锁成就不能重复通知');

  configs.set('成就解锁反馈', '{玩家}|{成就名称}|{成就ID}|{成就描述}|{检定回复}');
  complete(alice, 'rc', { '$m大成功': 1 }, 'D100=1');
  assert.match(replies[1].text, /alice\|命运眷顾\|critical-1\|获得 1 次大成功\|D100=1/);
  assert.equal(JSON.parse(variables.get(variableKey(alice, stateKey))).unlocks.length, 2);

  const bob = context('bob');
  complete(bob, 'rch', { '$m普通成功': 9, '$m大成功': 1 });
  assert.equal(replies.length, 3, '同一次可以解锁多个成就');
  assert.equal(replies[2].route, 'private', '暗骰反馈必须私聊');
  assert.match(replies[2].text, /初试身手/);
  assert.match(replies[2].text, /命运眷顾/);

  const invalid = context('invalid');
  set(invalid, '$m普通成功', 10);
  complete(invalid, 'ra');
  assert.equal(replies.length, 3, '帮助或错误回复没有计数变化时不评估');
  complete(invalid, 'analyzed', { '$m普通成功': 11 });
  assert.equal(replies.length, 3, '非检定命令不评估');
  complete(invalid, 'ra', { '$m普通成功': 12 }, '');
  assert.equal(replies.length, 3, '没有发送回复时不评估');

  configs.set('成就系统启用', false);
  complete(invalid, 'ra', { '$m普通成功': 13 });
  assert.equal(replies.length, 3);
  configs.set('成就系统启用', true);
  configs.set('成就解锁反馈', '');
  complete(invalid, 'ra', { '$m普通成功': 14 });
  assert.equal(replies.length, 3, '空反馈仍然保存状态');
  assert.equal(JSON.parse(variables.get(variableKey(invalid, stateKey))).unlocks.length, 1);

  configs.set('成就解锁反馈', '{玩家} {成就名称}');
  const broken = context('broken');
  set(broken, stateKey, '{invalid json');
  complete(broken, 'ra', { '$m大成功': 1 });
  assert.equal(variables.get(variableKey(broken, stateKey)), '{invalid json', '损坏状态不得覆盖');
  assert.equal(replies.length, 3);

  const unknownVersion = context('future');
  set(unknownVersion, stateKey, JSON.stringify({ version: 2, unlocks: [] }));
  complete(unknownVersion, 'ra', { '$m大成功': 1 });
  assert.equal(JSON.parse(variables.get(variableKey(unknownVersion, stateKey))).version, 2);
  assert.equal(replies.length, 3);

  const wrongType = context('wrong-type');
  set(wrongType, stateKey, 7);
  complete(wrongType, 'ra', { '$m大成功': 1 });
  assert.equal(variables.get(variableKey(wrongType, stateKey)), 7);
  assert.equal(replies.length, 3);

  const legacy = context('legacy');
  set(legacy, stateKey, JSON.stringify({ unlocks: [{ achievementId: 'checks-10', unlockedAt: 1 }] }));
  complete(legacy, 'ra', { '$m普通成功': 9, '$m大成功': 1 });
  const migrated = JSON.parse(variables.get(variableKey(legacy, stateKey)));
  assert.equal(migrated.version, 1);
  assert.equal(migrated.unlocks[0].unlockedAt, 1, '迁移保留历史解锁时间');
  assert.match(replies[3].text, /命运眷顾/);
  assert.doesNotMatch(replies[3].text, /初试身手/);

  const failedSave = context('failed-save');
  const originalSave = sealStub.vars.strSet;
  sealStub.vars.strSet = () => { throw new Error('模拟写入失败'); };
  complete(failedSave, 'ra', { '$m大成功': 1 });
  assert.equal(replies.length, 4, '保存失败不能发送解锁反馈');
  sealStub.vars.strSet = originalSave;

  // 重载扩展后仍以个人变量为准。
  const savedConfigs = new Map(configs);
  delete require.cache[require.resolve('../dist/sealdice-js-ext.js')];
  sealStub.ext.find = () => registered[0];
  require('../dist/sealdice-js-ext.js');
  for (const [key, value] of savedConfigs) configs.set(key, value);
  complete(alice, 'ra', { '$m普通成功': 12 });
  assert.equal(replies.length, 4, '重载后不能重复通知');

  const previousUnlocks = variables.get(variableKey(alice, stateKey));
  registered[0].cmdMap.analyzed.solve(alice, message(alice), { getArgN: () => 'clear' });
  assert.equal(variables.get(variableKey(alice, stateKey)), previousUnlocks, '清空统计保留成就');
  assert.equal(variables.get(variableKey(alice, '$m普通成功')), 0);

  console.log('FLOW OK: 成就反馈、持久化、去重、玩家隔离、暗骰及异常状态检查通过');
} catch (e) {
  console.error('SMOKE FAIL:', e.message);
  console.error(e.stack);
  process.exit(1);
}
