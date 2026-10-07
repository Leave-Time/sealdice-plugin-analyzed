/** COC 检定统计：.analyzed 查看，.analyzed clear 清除。 */
import { installAchievementFlow } from './achievement-flow';

export interface CocStats {
  success: number;
  failure: number;
  normalSuccess: number;
  hardSuccess: number;
  extremeSuccess: number;
  criticalSuccess: number;
  fumble: number;
}

const emptyStats = (): CocStats => ({ success: 0, failure: 0, normalSuccess: 0, hardSuccess: 0, extremeSuccess: 0, criticalSuccess: 0, fumble: 0 });
const log = (message: string): void => console.log(`[analyzed] ${message}`);

const VAR_NAMES: Partial<Record<keyof CocStats, string>> = {
  normalSuccess: '$m普通成功',
  hardSuccess: '$m困难成功',
  extremeSuccess: '$m极难成功',
  criticalSuccess: '$m大成功',
  failure: '$m失败',
  fumble: '$m大失败',
};

function readStats(ctx: seal.MsgContext): CocStats {
  const stats = emptyStats();
  (Object.keys(VAR_NAMES) as (keyof CocStats)[]).forEach((key) => {
    const [value, exists] = seal.vars.intGet(ctx, VAR_NAMES[key]!);
    stats[key] = exists && Number.isFinite(value) && value >= 0 ? value : 0;
  });
  stats.success = stats.normalSuccess + stats.hardSuccess + stats.extremeSuccess + stats.criticalSuccess;
  return stats;
}

function writeStats(ctx: seal.MsgContext, stats: CocStats): void {
  (Object.keys(VAR_NAMES) as (keyof CocStats)[]).forEach((key) => {
    seal.vars.intSet(ctx, VAR_NAMES[key]!, Math.max(0, Math.trunc(stats[key])));
  });
}

function formatStats(stats: CocStats, name: string): string {
  const failureCount = stats.failure + stats.fumble;
  const total = stats.success + failureCount;
  const rate = total === 0 ? 0 : stats.success / total * 100;
  return [
    `${name} 的 COC 检定统计`,
    `检定次数：${total}`,
    `成功率：${rate.toFixed(2)}%`,
    `成功次数：${stats.success}（成功 ${stats.normalSuccess}、困难成功 ${stats.hardSuccess}、极难成功 ${stats.extremeSuccess}、大成功 ${stats.criticalSuccess}）`,
    `失败次数：${failureCount}（失败 ${stats.failure}、大失败 ${stats.fumble}）`,
  ].join('\n');
}

function formatReply(ctx: seal.MsgContext, stats: CocStats, fallbackName: string): string {
  const [playerName, exists] = seal.vars.strGet(ctx, '$t玩家');
  const name = exists && playerName.trim() ? playerName.trim() : fallbackName;
  return formatStats(stats, name);
}

function main(): void {
  let ext = seal.ext.find('analyzed');
  if (!ext) {
    ext = seal.ext.new('analyzed', 'Leave_Time', '0.1.0-alpha');
    ext.autoActive = true;
    seal.ext.register(ext);
    log('扩展已注册，版本：0.1.0-alpha');
  }
  installAchievementFlow(ext, readStats);
  const cmd = seal.ext.newCmdItemInfo();
  cmd.name = 'analyzed';
  cmd.help = '统计 COC 检定结果。用法：.analyzed 查看统计；.analyzed clear 清除自己的统计。';
  cmd.solve = (ctx, msg, args) => {
    const action = args.getArgN(1).toLowerCase();
    if (action === 'clear') {
      log(`收到清除请求：player=${msg.platform}:${msg.sender.userId}`);
      writeStats(ctx, emptyStats());
      seal.replyToSender(ctx, msg, '已清除你的 COC 检定统计。');
      return seal.ext.newCmdExecuteResult(true);
    }
    if (action) { log(`收到未知子命令：${action}`); const result = seal.ext.newCmdExecuteResult(false); result.showHelp = true; return result; }
    const stats = readStats(ctx);
    log(`查询统计：player=${msg.platform}:${msg.sender.userId}, success=${stats.success}, failure=${stats.failure + stats.fumble}`);
    seal.replyToSender(ctx, msg, formatReply(ctx, stats, msg.sender.nickname || '你'));
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap.analyzed = cmd;
}

main();
