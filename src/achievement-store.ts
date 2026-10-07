import { createEmptyAchievementState } from './achievements';
import type { AchievementState, AchievementStore, AchievementUnlock } from './achievements';

export const ACHIEVEMENT_STATE_KEY = '$manalyzed_achievement_state_v1';

/** 损坏或未知版本的数据不覆盖，避免已解锁成就丢失或反复通知。 */
export const personalAchievementStore: AchievementStore = {
  load(ctx): AchievementState {
    const [raw, exists] = seal.vars.strGet(ctx, ACHIEVEMENT_STATE_KEY);
    if (!exists) {
      const [, integerExists] = seal.vars.intGet(ctx, ACHIEVEMENT_STATE_KEY);
      if (integerExists) throw new Error('成就状态变量类型不匹配');
      return createEmptyAchievementState();
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('成就状态格式无效');
    const data = parsed as { version?: unknown; unlocks?: unknown };
    // 兼容预留接口中未带版本字段的状态。
    if (data.version !== undefined && data.version !== 1) throw new Error('不支持的成就状态版本');
    if (!Array.isArray(data.unlocks)) throw new Error('成就解锁列表格式无效');
    const ids = new Set<string>();
    const unlocks: AchievementUnlock[] = data.unlocks.map((item: unknown) => {
      if (typeof item !== 'object' || item === null) throw new Error('成就解锁记录格式无效');
      const record = item as { achievementId?: unknown; unlockedAt?: unknown };
      if (typeof record.achievementId !== 'string' || !record.achievementId.trim()
        || typeof record.unlockedAt !== 'number' || !Number.isFinite(record.unlockedAt)
        || record.unlockedAt < 0 || ids.has(record.achievementId)) {
        throw new Error('成就解锁记录字段无效');
      }
      ids.add(record.achievementId);
      return { achievementId: record.achievementId, unlockedAt: record.unlockedAt };
    });
    return { unlocks };
  },
  save(ctx, state): void {
    seal.vars.strSet(ctx, ACHIEVEMENT_STATE_KEY, JSON.stringify({ version: 1, unlocks: state.unlocks }));
  },
};
