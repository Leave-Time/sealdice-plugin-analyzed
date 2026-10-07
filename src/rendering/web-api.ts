export interface RenderPage {
  title: string;
  page: number;
  pages: number;
  unlocked: number;
  total: number;
  achievements: import('../achievements/service').AchievementView[];
}

export function installRenderConfig(ext: seal.ExtInfo): void {
  seal.ext.registerOptionConfig(ext, '成就渲染方式', '文字', ['文字', '图片'], '成就列表与详情的展示方式', '成就');
  seal.ext.registerStringConfig(ext, '成就渲染API', '', '图片模式使用的 API 地址；POST JSON，响应 { imageUrl: "https://..." }；留空回退文字', '成就');
  seal.ext.registerStringConfig(ext, '成就渲染Token', '', '可选 Bearer Token，只发送给配置的 API', '成就');
}

export async function renderImage(ext: seal.ExtInfo, page: RenderPage): Promise<string | undefined> {
  if (seal.ext.getOptionConfig(ext, '成就渲染方式') !== '图片') return undefined;
  const endpoint = seal.ext.getStringConfig(ext, '成就渲染API').trim();
  if (!endpoint) return undefined;
  if (!/^https?:\/\/[^\s]+$/.test(endpoint)) throw new Error('渲染 API 地址无效');
  const token = seal.ext.getStringConfig(ext, '成就渲染Token');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const request = async (): Promise<string> => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ version: 1, ...page }),
    });
    if (!response.ok) throw new Error(`图片渲染失败：HTTP ${response.status}`);
    const data: unknown = await response.json();
    const url = (data as { imageUrl?: unknown } | null)?.imageUrl;
    // 拒绝海豹/CQ 标记中的控制字符，防止图片 URL 改变消息段结构。
    if (typeof url !== 'string' || !/^https?:\/\/[^\s\[\]{}]+$/.test(url)) throw new Error('渲染接口未返回有效图片 URL');
    return `[CQ:image,file=${url.replace(/&/g, '&amp;').replace(/,/g, '&#44;')}]`;
  };
  try {
    return await Promise.race([request(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('图片渲染超时')), 10000);
    })]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
