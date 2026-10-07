import type { CocStats } from './index';

/** 成就的稳定标识。发布后不要修改已有成就的 id。 */
export type AchievementId = string;

/** 玩家已经解锁的成就记录。 */
export interface AchievementUnlock {
  achievementId: AchievementId;
  unlockedAt: number;
}

/** 成就系统需要保存的最小状态。具体如何写入 $m 变量由适配器决定。 */
export interface AchievementState {
  unlocks: AchievementUnlock[];
}

/** 用于未来接入海豹个人变量或其他存储方式的接口。 */
export interface AchievementStore {
  load(ctx: seal.MsgContext): AchievementState;
  save(ctx: seal.MsgContext, state: AchievementState): void;
}

/** 一项成就的声明。progress 返回当前进度，target 是解锁所需值。 */
export interface AchievementDefinition {
  id: AchievementId;
  name: string;
  description: string;
  target: number;
  progress(stats: CocStats): number;
}

export interface AchievementProgress {
  definition: AchievementDefinition;
  current: number;
  unlocked: boolean;
}

export interface AchievementEvaluation {
  progress: AchievementProgress[];
  newlyUnlocked: AchievementUnlock[];
  state: AchievementState;
}

/**
 * 内置成就先集中注册在这里。新增成就只需要添加声明，不需要修改统计读取逻辑。
 * 成就 id 一旦发布应保持不变，名称和描述可以调整。
 */
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: 'checks-10',
    name: '初试身手',
    description: '完成 10 次 COC 检定',
    target: 10,
    progress: (stats) => stats.success + stats.failure + stats.fumble,
  },
  {
    id: 'critical-1',
    name: '命运眷顾',
    description: '获得 1 次大成功',
    target: 1,
    progress: (stats) => stats.criticalSuccess,
  },
];

const emptyState = (): AchievementState => ({ unlocks: [] });

/** 纯函数评估器，方便以后接入命令、测试和其他展示方式。 */
export function evaluateAchievements(
  definitions: readonly AchievementDefinition[],
  stats: CocStats,
  previous: AchievementState,
  now = Date.now(),
): AchievementEvaluation {
  const unlocks = previous.unlocks.slice();
  const unlockedIds = new Set(unlocks.map((unlock) => unlock.achievementId));
  const progress = definitions.map((definition) => {
    const current = Math.max(0, Math.trunc(definition.progress(stats)));
    return {
      definition,
      current,
      unlocked: unlockedIds.has(definition.id),
    };
  });
  const newlyUnlocked: AchievementUnlock[] = [];

  progress.forEach((item) => {
    if (!item.unlocked && item.current >= item.definition.target) {
      const unlock = { achievementId: item.definition.id, unlockedAt: now };
      unlocks.push(unlock);
      newlyUnlocked.push(unlock);
      item.unlocked = true;
    }
  });

  return { progress, newlyUnlocked, state: { unlocks } };
}

/** 默认状态工厂，供存储适配器处理缺失或损坏的数据时使用。 */
export function createEmptyAchievementState(): AchievementState {
  return emptyState();
}
