function qqId(value: string, prefix: string): string {
  const id = value.startsWith(prefix) ? value.slice(prefix.length) : value;
  if (!/^\d+$/.test(id)) throw new Error('OneBot 需要有效的 QQ 数字 ID');
  return id;
}

/** OneBot v11 HTTP API，节点内容使用 text 消息段，不解析 CQ 码。 */
export async function sendForward(
  ext: seal.ExtInfo, ctx: seal.MsgContext, msg: seal.Message, blocks: string[],
): Promise<boolean> {
  if (seal.ext.getOptionConfig(ext, '成就文字发送方式') !== '合并转发') return false;
  if (msg.platform !== 'QQ') throw new Error('合并转发只支持 QQ OneBot');
  const endpoint = seal.ext.getStringConfig(ext, 'OneBot HTTP API').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s?#]+$/.test(endpoint)) throw new Error('OneBot HTTP API 地址未配置或无效');
  const botId = qqId(ctx.endPoint.userId, 'QQ:');
  const privateMessage = msg.messageType === 'private';
  const target = privateMessage
    ? { user_id: qqId(msg.sender.userId, 'QQ:') }
    : { group_id: qqId(msg.groupId, 'QQ-Group:') };
  const token = seal.ext.getStringConfig(ext, 'OneBot HTTP Token');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const request = async (): Promise<boolean> => {
    const response = await fetch(`${endpoint}/${privateMessage ? 'send_private_forward_msg' : 'send_group_forward_msg'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...target, messages: blocks.map((text) => ({
        type: 'node', data: { name: ctx.endPoint.nickname || '成就统计', uin: botId,
          content: [{ type: 'text', data: { text } }] },
      })) }),
    });
    if (!response.ok) throw new Error(`OneBot HTTP ${response.status}`);
    const data: unknown = await response.json();
    const result = data as { status?: unknown; retcode?: unknown } | null;
    if (result?.status !== 'ok' || result.retcode !== 0) throw new Error('OneBot 合并转发失败');
    return true;
  };
  try {
    return await Promise.race([request(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('OneBot 合并转发超时')), 10000);
    })]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
