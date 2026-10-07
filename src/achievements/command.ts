import { renderImage } from '../rendering/web-api';
import type { RenderPage } from '../rendering/web-api';

import type { AchievementHook } from './service';

const PAGE_SIZE = 10;

export function installAchievementCommand(ext: seal.ExtInfo, hook: AchievementHook): void {
  const cmd = seal.ext.newCmdItemInfo();
  cmd.name = 'achivements';
  cmd.help = '.achivements list [页码]：所有成就；.achivements info 名称：成就详情';
  cmd.allowDelegate = false;
  cmd.solve = (ctx, msg, args) => {
    const action = args.getArgN(1).toLowerCase();
    const result = seal.ext.newCmdExecuteResult(true);
    try {
      let page: RenderPage;
      const title = `${ctx.player?.name || msg.sender.nickname || '你'} 的成就`;
      if (action === 'info') {
        const name = args.args.slice(1).join(' ').trim();
        if (!name) { result.showHelp = true; return result; }
        const item = hook.info(ctx, name);
        if (!item) { seal.replyToSender(ctx, msg, '未找到可查询的成就。'); return result; }
        page = { title, page: 1, pages: 1, unlocked: item.unlocked ? 1 : 0, total: 1, achievements: [item] };
      } else if (!action || action === 'list' || /^\d+$/.test(action)) {
        const number = Number(action === 'list' ? args.getArgN(2) || 1 : action || 1);
        if (!Number.isSafeInteger(number) || number < 1) { result.showHelp = true; return result; }
        const items = hook.list(ctx);
        const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
        if (number > pages) { seal.replyToSender(ctx, msg, `页码超出范围，共 ${pages} 页。`); return result; }
        page = { title, page: number, pages, total: items.length, unlocked: items.filter((item) => item.unlocked).length,
          achievements: items.slice((number - 1) * PAGE_SIZE, number * PAGE_SIZE) };
      } else { result.showHelp = true; return result; }

      const text = [page.title, `已解锁：${page.unlocked}/${page.total} 项（第 ${page.page}/${page.pages} 页）`,
        ...page.achievements.map((item) => `${item.unlocked ? '已解锁' : '未解锁'}：${item.name}${item.source ? ` [${item.source}/${item.id}]` : ''}\n${item.description}${item.unlockedAt !== undefined ? `\n解锁时间：${new Date(item.unlockedAt).toISOString()}` : ''}`),
      ].join('\n');
      // solve 必须同步返回命令执行结果，网络请求在独立异步流程中完成。
      void (async () => {
        let image: string | undefined;
        try { image = await renderImage(ext, page); }
        catch (error) { console.log(`[analyzed] 图片渲染失败，使用文本：${String(error)}`); }
        seal.replyToSender(ctx, msg, image || text);
      })().catch((error: unknown) => console.log(`[analyzed] 成就回复失败：${String(error)}`));
    } catch (error) {
      console.log(`[analyzed] 成就查询失败：${String(error)}`);
      seal.replyToSender(ctx, msg, '成就查询失败，请检查名称是否重复或联系骰主检查日志。');
    }
    return result;
  };
  ext.cmdMap.achivements = cmd;
}
