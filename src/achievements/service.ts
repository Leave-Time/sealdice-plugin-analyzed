export interface AchievementInput {
  source: string;
  id: string;
  name: string;
  description: string;
  hidden?: boolean;
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
  register(achievement: AchievementInput): void;
  list(ctx: seal.MsgContext): AchievementView[];
  info(ctx: seal.MsgContext, name: string): AchievementView | undefined;
  /** 同步持久化；重复登记返回 recorded: false，验证或存储失败抛异常。 */
  record(ctx: seal.MsgContext, achievement: AchievementInput): {
    recorded: boolean;
    total: number;
    achievement: AchievementRecord;
  };
}

export interface AchievementView {
  name: string;
  description: string;
  unlocked: boolean;
  hidden: boolean;
  source?: string;
  id?: string;
  unlockedAt?: number;
}

export interface AchievementCatalog {
  list(): AchievementInput[];
  register(input: AchievementInput): void;
}

export function validateAchievement(input: AchievementInput): AchievementInput {
  if (!input || typeof input !== 'object') throw new Error('成就信息必须是对象');
  for (const field of ['source', 'id', 'name', 'description'] as const) {
    if (typeof input[field] !== 'string' || (field !== 'description' && !input[field].trim())) {
      throw new Error(`成就字段 ${field} 无效`);
    }
    if (input[field].length > (field === 'description' ? 2000 : 200)) throw new Error(`成就字段 ${field} 过长`);
  }
  if (input.hidden !== undefined && typeof input.hidden !== 'boolean') throw new Error('hidden 必须为布尔值');
  return { source: input.source, id: input.id, name: input.name, description: input.description, hidden: input.hidden ?? false };
}

export function createAchievementHook(store: AchievementStore, catalog: AchievementCatalog): AchievementHook {
  const list = (ctx: seal.MsgContext): AchievementView[] => {
    const records = store.load(ctx).records;
    const definitions = catalog.list();
    // 保留来源插件卸载前的已解锁成就。
    records.forEach((record) => {
      if (!definitions.some((item) => item.source === record.source && item.id === record.id)) definitions.push(record);
    });
    return definitions.map((definition) => {
      const record = records.find((item) => item.source === definition.source && item.id === definition.id);
      if (definition.hidden && !record) return { name: '隐藏成就', description: '解锁后揭晓', hidden: true, unlocked: false };
      return { ...definition, hidden: definition.hidden ?? false, unlocked: !!record, unlockedAt: record?.unlockedAt };
    });
  };
  return {
    version: 1,
    register: (input) => catalog.register(validateAchievement(input)),
    list,
    info(ctx, name) {
      const matches = list(ctx).filter((item) => item.id && (item.name === name || `${item.source}/${item.id}` === name));
      if (matches.length > 1) throw new Error('成就名称重复，请使用 来源插件/成就ID 查询');
      return matches[0];
    },
    record(ctx, input) {
      if (!ctx.player?.userId) throw new Error('成就登记需要玩家上下文');
      const data = validateAchievement(input);
      // record 的旧调用形式仍然可用，同时补充定义目录。
      const known = catalog.list().find((item) => item.source === data.source && item.id === data.id);
      if (!known) catalog.register(data);
      const state = store.load(ctx);
      const existing = state.records.find((item) => item.source === data.source && item.id === data.id);
      if (existing) return { recorded: false, total: state.records.length, achievement: { ...existing } };
      const achievement = { ...(known || data), unlockedAt: Date.now() };
      store.save(ctx, { records: [...state.records, achievement] });
      return { recorded: true, total: state.records.length + 1, achievement: { ...achievement } };
    },
  };
}
