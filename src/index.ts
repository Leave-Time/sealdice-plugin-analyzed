import { createCatalog } from './achievements/catalog';
import { installAchievementCommand } from './achievements/command';
import { createAchievementHook } from './achievements/service';
import { personalAchievementStore } from './achievements/store';
import { installRenderConfig } from './rendering/web-api';
import { installStatsCommand } from './stats/command';
import { statsApi } from './stats/service';

function main(): void {
  let ext = seal.ext.find('analyzed');
  if (!ext) {
    ext = seal.ext.new('analyzed', 'Leave_Time', '0.2.0');
    ext.autoActive = true;
    seal.ext.register(ext);
  }
  Object.assign(ext, { version: '0.2.0', onMessageReceived: undefined, onMessageSend: undefined, onCommandReceived: undefined });
  seal.ext.unregisterConfig(ext, '成就系统启用', '成就解锁反馈');
  const hook = createAchievementHook(personalAchievementStore, createCatalog(ext));
  Object.assign(globalThis, { sealAchievements: hook, sealStats: statsApi });
  installRenderConfig(ext);
  installAchievementCommand(ext, hook);
  installStatsCommand(ext);
}

main();
