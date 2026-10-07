export interface AchievementInput {
  source: string;
  id: string;
  name: string;
  description: string;
}

export interface AchievementRecord extends AchievementInput {
  /** 登记时间，毫秒时间戳。 */
  unlockedAt: number;
}

export interface AchievementState {
  records: AchievementRecord[];
}

export interface AchievementStore {
  load(ctx: seal.MsgContext): AchievementState;
  save(ctx: seal.MsgContext, state: AchievementState): void;
}

export interface AchievementHook {
  version: 1;
  /** 同步持久化；重复登记返回 recorded: false，验证或存储失败抛异常。 */
  record(ctx: seal.MsgContext, achievement: AchievementInput): {
    recorded: boolean;
    total: number;
    achievement: AchievementRecord;
  };
}

export function validateAchievement(input: AchievementInput): AchievementInput {
  if (!input || typeof input !== 'object') throw new Error('成就信息必须是对象');
  for (const field of ['source', 'id', 'name', 'description'] as const) {
    if (typeof input[field] !== 'string' || (field !== 'description' && !input[field].trim())) {
      throw new Error(`成就字段 ${field} 无效`);
    }
    if (input[field].length > (field === 'description' ? 2000 : 200)) throw new Error(`成就字段 ${field} 过长`);
  }
  return { source: input.source, id: input.id, name: input.name, description: input.description };
}

export function createAchievementHook(store: AchievementStore): AchievementHook {
  return {
    version: 1,
    record(ctx, input) {
      if (!ctx.player?.userId) throw new Error('成就登记需要玩家上下文');
      const data = validateAchievement(input);
      const state = store.load(ctx);
      const existing = state.records.find((item) => item.source === data.source && item.id === data.id);
      if (existing) return { recorded: false, total: state.records.length, achievement: { ...existing } };
      const achievement = { ...data, unlockedAt: Date.now() };
      store.save(ctx, { records: [...state.records, achievement] });
      return { recorded: true, total: state.records.length + 1, achievement: { ...achievement } };
    },
  };
}
