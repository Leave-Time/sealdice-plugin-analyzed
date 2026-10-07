import { getStats } from './service';

export function installStatsCommand(ext: seal.ExtInfo): void {
  const cmd = seal.ext.newCmdItemInfo();
  cmd.name = 'analyzed';
  cmd.help = '.analyzed 查看检定次数、成功率及各类结果次数';
  cmd.allowDelegate = false;
  cmd.solve = (ctx, msg, args) => {
    const result = seal.ext.newCmdExecuteResult(true);
    if (args.getArgN(1)) { result.showHelp = true; return result; }
    const stats = getStats(ctx);
    seal.replyToSender(ctx, msg, [
      `${ctx.player?.name || msg.sender.nickname || '你'} 的检定统计`,
      `检定次数：${stats.total}；成功率：${(stats.successRate * 100).toFixed(2)}%`,
      `成功次数：${stats.successes}（普通 ${stats.normalSuccess}、困难 ${stats.hardSuccess}、极难 ${stats.extremeSuccess}、大成功 ${stats.criticalSuccess}）`,
      `失败次数：${stats.failures}（失败 ${stats.failure}、大失败 ${stats.fumble}）`,
    ].join('\n'));
    return result;
  };
  ext.cmdMap.analyzed = cmd;
}
