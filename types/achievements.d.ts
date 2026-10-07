/** 调用插件可引用本声明；运行时检查 hook 是否已加载。 */
declare var sealAchievements: import('../src/achievements/service').AchievementHook | undefined;
declare var sealStats: typeof import('../src/stats/service').statsApi | undefined;
