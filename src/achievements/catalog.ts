import { validateAchievement } from './service';
import type { AchievementCatalog, AchievementInput } from './service';

const KEY = 'achievement_catalog_v1';

export function createCatalog(ext: seal.ExtInfo): AchievementCatalog {
  const list = (): AchievementInput[] => {
    const raw = ext.storageGet(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('成就目录格式无效');
    const data = parsed as { version?: unknown; definitions?: unknown };
    if (data.version !== 1 || !Array.isArray(data.definitions)) throw new Error('成就目录版本或格式无效');
    const ids = new Set<string>();
    return data.definitions.map((item: AchievementInput) => {
      const definition = validateAchievement(item);
      const id = JSON.stringify([definition.source, definition.id]);
      if (ids.has(id)) throw new Error('成就目录记录重复');
      ids.add(id);
      return definition;
    });
  };
  return {
    list,
    register(input) {
      const definition = validateAchievement(input);
      const definitions = list();
      const index = definitions.findIndex((item) => item.source === definition.source && item.id === definition.id);
      if (index === -1) definitions.push(definition);
      else definitions[index] = definition;
      ext.storageSet(KEY, JSON.stringify({ version: 1, definitions }));
    },
  };
}
