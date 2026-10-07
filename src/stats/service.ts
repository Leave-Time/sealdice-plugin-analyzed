const VARIABLES = {
  normalSuccess: '$m普通成功', hardSuccess: '$m困难成功', extremeSuccess: '$m极难成功',
  criticalSuccess: '$m大成功', failure: '$m失败', fumble: '$m大失败',
};

export type CheckResult = keyof typeof VARIABLES;
export type CheckStats = Record<CheckResult, number> & {
  successes: number;
  failures: number;
  total: number;
  /** 0 到 1；没有检定时返回 0。 */
  successRate: number;
};

export function getCount(ctx: seal.MsgContext, kind: CheckResult): number {
  if (!Object.prototype.hasOwnProperty.call(VARIABLES, kind)) throw new Error('未知检定结果类型');
  const [value, exists] = seal.vars.intGet(ctx, VARIABLES[kind]);
  return exists && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

export function getStats(ctx: seal.MsgContext): CheckStats {
  const counts = {} as Record<CheckResult, number>;
  (Object.keys(VARIABLES) as CheckResult[]).forEach((kind) => { counts[kind] = getCount(ctx, kind); });
  const successes = counts.normalSuccess + counts.hardSuccess + counts.extremeSuccess + counts.criticalSuccess;
  const failures = counts.failure + counts.fumble;
  const total = successes + failures;
  return { ...counts, successes, failures, total, successRate: total ? successes / total : 0 };
}

export const statsApi = {
  version: 1 as const,
  getStats,
  getCount,
  getSuccessRate: (ctx: seal.MsgContext): number => getStats(ctx).successRate,
  getSuccessCount: (ctx: seal.MsgContext): number => getStats(ctx).successes,
  getFailureCount: (ctx: seal.MsgContext): number => getStats(ctx).failures,
};
