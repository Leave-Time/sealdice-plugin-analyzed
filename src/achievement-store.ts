import { validateAchievement } from './achievements';
import type { AchievementRecord, AchievementStore } from './achievements';

// 保留旧变量名，在同一变量中升级数据版本。
export const ACHIEVEMENT_STATE_KEY = '$manalyzed_achievement_state_v1';

export const personalAchievementStore: AchievementStore = {
  load(ctx) {
    const [raw, exists] = seal.vars.strGet(ctx, ACHIEVEMENT_STATE_KEY);
    if (!exists) {
      const [, integerExists] = seal.vars.intGet(ctx, ACHIEVEMENT_STATE_KEY);
      if (integerExists) throw new Error('成就状态变量类型不匹配');
      return { records: [] };
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('成就状态格式无效');
    const data = parsed as { version?: unknown; records?: unknown; unlocks?: unknown };
    let records: unknown;
    if (data.version === 2) {
      records = data.records;
    } else if (data.version === 1 || data.version === undefined) {
      if (!Array.isArray(data.unlocks)) throw new Error('旧成就状态格式无效');
      records = data.unlocks.map((item: unknown) => {
        if (!item || typeof item !== 'object') throw new Error('旧成就记录格式无效');
        const old = item as { achievementId?: unknown; unlockedAt?: unknown };
        const names: Record<string, string> = { 'checks-10': '初试身手', 'critical-1': '命运眷顾' };
        return {
          source: 'analyzed', id: old.achievementId,
          name: typeof old.achievementId === 'string' ? names[old.achievementId] || old.achievementId : '',
          description: '', unlockedAt: old.unlockedAt,
        };
      });
    } else {
      throw new Error('不支持的成就状态版本');
    }
    if (!Array.isArray(records)) throw new Error('成就列表格式无效');
    const ids = new Set<string>();
    const validated: AchievementRecord[] = records.map((item: unknown) => {
      const record = item as AchievementRecord;
      const input = validateAchievement(record);
      if (!Number.isFinite(record.unlockedAt) || record.unlockedAt < 0) throw new Error('成就时间无效');
      const id = JSON.stringify([input.source, input.id]);
      if (ids.has(id)) throw new Error('成就记录重复');
      ids.add(id);
      return { ...input, unlockedAt: record.unlockedAt };
    });
    return { records: validated };
  },
  save(ctx, state) {
    seal.vars.strSet(ctx, ACHIEVEMENT_STATE_KEY, JSON.stringify({ version: 2, records: state.records }));
  },
};
