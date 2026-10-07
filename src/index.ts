import { personalAchievementStore } from './achievement-store';
import { createAchievementHook } from './achievements';

const PAGE_SIZE = 10;

function main(): void {
  let ext = seal.ext.find('analyzed');
  if (!ext) {
    ext = seal.ext.new('analyzed', 'Leave_Time', '0.1.0-alpha');
    ext.autoActive = true;
    seal.ext.register(ext);
  }
  // 保留安装标识，清理同一 VM 热重载前的旧功能。
  delete ext.cmdMap.analyzed;
  Object.assign(ext, { onMessageReceived: undefined, onMessageSend: undefined, onCommandReceived: undefined });
  seal.ext.unregisterConfig(ext, '成就系统启用', '成就解锁反馈');
  Object.assign(globalThis, { sealAchievements: createAchievementHook(personalAchievementStore) });

  const cmd = seal.ext.newCmdItemInfo();
  cmd.name = 'achivements';
  cmd.help = '查看自己的成就统计。用法：.achivements [页码]';
  cmd.allowDelegate = false;
  cmd.solve = (ctx, msg, args) => {
    const value = args.getArgN(1);
    const page = value ? Number(value) : 1;
    if (!Number.isSafeInteger(page) || page < 1) {
      const result = seal.ext.newCmdExecuteResult(true);
      result.showHelp = true;
      return result;
    }
    try {
      const records = personalAchievementStore.load(ctx).records;
      const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
      if (page > pages) {
        seal.replyToSender(ctx, msg, `页码超出范围，共 ${pages} 页。`);
      } else {
        const items = records.slice().sort((a, b) => b.unlockedAt - a.unlockedAt)
          .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        const lines = items.map((item) => `「${item.name}」[${item.source}]${item.description ? `\n${item.description}` : ''}`);
        seal.replyToSender(ctx, msg, [
          `${ctx.player?.name || msg.sender.nickname || '你'} 的成就`,
          `已完成：${records.length} 项（第 ${page}/${pages} 页）`,
          ...lines,
        ].join('\n'));
      }
    } catch (error) {
      console.log(`[analyzed] 成就查询失败：${String(error)}`);
      seal.replyToSender(ctx, msg, '成就数据读取失败，请联系骰主检查日志。');
    }
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap.achivements = cmd;
}

main();
