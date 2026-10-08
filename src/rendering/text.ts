import type { RenderPage } from './web-api';

/** 按服务器本地日期展示，保留存储中的完整时间戳。 */
function dateOnly(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatAchievementText(page: RenderPage, debug: boolean): string[] {
  const header = `${page.title}\n已解锁 ${page.unlocked} / ${page.total} 项 · 第 ${page.page}/${page.pages} 页`;
  const items = page.achievements.map((item, index) => [
    `${(page.page - 1) * 10 + index + 1}. ${item.name} [${item.unlocked ? '已解锁' : '未解锁'}]`,
    item.description,
    item.unlockedAt !== undefined ? `解锁日期：${dateOnly(item.unlockedAt)}` : '',
    debug && item.source && item.id ? `ID：${item.source}/${item.id}` : '',
  ].filter(Boolean).join('\n'));
  return [header, ...(items.length ? items : ['暂无成就'])];
}
