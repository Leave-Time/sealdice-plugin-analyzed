import { personalAchievementStore } from './achievement-store';
import { ACHIEVEMENTS, evaluateAchievements } from './achievements';
import type { AchievementDefinition, AchievementStore } from './achievements';

import type { CocStats } from './index';

const ENABLED = '成就系统启用';
const FEEDBACK = '成就解锁反馈';
const DEFAULT_FEEDBACK = '{玩家} 解锁成就「{成就名称}」！\n{成就描述}';
const CHECK_COMMANDS = new Set(['ra', 'rc', 'rah', 'rch']);
const COUNTERS: (keyof CocStats)[] = ['normalSuccess', 'hardSuccess', 'extremeSuccess', 'criticalSuccess', 'failure', 'fumble'];

interface PendingCheck {
  before: CocStats;
  replies: string[];
  receivedAt: number;
}

function contextKey(ctx: seal.MsgContext): string | undefined {
  if (!ctx.player || !ctx.endPoint) return undefined;
  return JSON.stringify([ctx.endPoint.userId, ctx.group?.groupId || '', ctx.player.userId]);
}

/** 发送文本用于关联回复；成就进度只取自 $m 累计变量，不解析文案中的成功等级。 */
export function installAchievementFlow(
  ext: seal.ExtInfo,
  readStats: (ctx: seal.MsgContext) => CocStats,
  definitions: readonly AchievementDefinition[] = ACHIEVEMENTS,
  store: AchievementStore = personalAchievementStore,
): void {
  seal.ext.registerBoolConfig(ext, ENABLED, true, '检定回复后检查并保存成就');
  seal.ext.registerStringConfig(ext, FEEDBACK, DEFAULT_FEEDBACK,
    '支持 {玩家}、{成就名称}、{成就描述}、{成就ID}、{检定回复}；留空只保存解锁状态');

  const pending = new Map<string, PendingCheck>();
  ext.onMessageReceived = (ctx) => {
    const key = contextKey(ctx);
    if (!key) return;
    pending.delete(key);
    if (!seal.ext.getBoolConfig(ext, ENABLED)) return;
    const now = Date.now();
    // 对未进入命令完成回调的消息回收快照，限制内存占用。
    pending.forEach((value, id) => {
      if (now - value.receivedAt > 60000) pending.delete(id);
    });
    if (pending.size >= 512) pending.delete(pending.keys().next().value!);
    pending.set(key, { before: readStats(ctx), replies: [], receivedAt: now });
  };

  ext.onMessageSend = (ctx, msg) => {
    const key = contextKey(ctx);
    const check = key ? pending.get(key) : undefined;
    if (check && Date.now() - check.receivedAt <= 60000 && msg.message) {
      check.replies.push(msg.message);
    }
  };

  ext.onCommandReceived = (ctx, msg, args) => {
    const key = contextKey(ctx);
    const check = key ? pending.get(key) : undefined;
    // 在反馈前移除快照，反馈自己的发送回调不会参与本次评估。
    if (key) pending.delete(key);
    if (!check || Date.now() - check.receivedAt > 60000 || !check.replies.length
      || !CHECK_COMMANDS.has(args.command.toLowerCase()) || !seal.ext.getBoolConfig(ext, ENABLED)) return;

    try {
      const playerCtx = seal.getCtxProxyFirst(ctx, args);
      // 代骰目标的检定前快照不在当前流程内，避免用发起者快照评估目标。
      if (contextKey(playerCtx) !== key) return;
      const stats = readStats(playerCtx);
      if (!COUNTERS.some((counter) => stats[counter] > check.before[counter])) return;
      const evaluation = evaluateAchievements(definitions, stats, store.load(playerCtx));
      if (!evaluation.newlyUnlocked.length) return;
      store.save(playerCtx, evaluation.state);

      const template = seal.ext.getStringConfig(ext, FEEDBACK);
      if (!template.trim()) return;
      const text = evaluation.newlyUnlocked.map((unlock) => {
        const definition = definitions.find((item) => item.id === unlock.achievementId)!;
        const fields: Record<string, string> = {
          '玩家': playerCtx.player?.name || msg.sender.nickname || '你',
          '成就名称': definition.name,
          '成就描述': definition.description,
          '成就ID': definition.id,
          '检定回复': check.replies.join('\n'),
        };
        return template.replace(/\{(玩家|成就名称|成就描述|成就ID|检定回复)\}/g, (_, field: string) => fields[field]);
      }).join('\n\n');
      if (args.command.toLowerCase().endsWith('h')) seal.replyPerson(playerCtx, msg, text);
      else seal.replyToSender(playerCtx, msg, text);
    } catch (error) {
      console.log(`[analyzed] 成就处理失败：${String(error)}`);
    }
  };
}
