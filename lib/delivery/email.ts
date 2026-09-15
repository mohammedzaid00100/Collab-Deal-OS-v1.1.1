export function buildNotificationEmail(payload: Record<string, unknown>, origin: string) {
  const subject = typeof payload.subject === 'string' ? payload.subject.slice(0, 200).replace(/[\r\n]/g, ' ') : 'Collab Deal OS account update';
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 5000) : 'There is an update in your account.';
  const base = new URL(origin);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && base.hostname === 'localhost')) throw new Error('INVALID_EMAIL_ORIGIN');
  const path = typeof payload.action_path === 'string' && /^\/(creator|brand)\/[a-zA-Z0-9/_-]+$/.test(payload.action_path)
    ? payload.action_path : '/login';
  const url = new URL(path, base.origin).href;
  return {
    subject,
    text: `${subject}\n\n${body}\n\nOpen your account: ${url}\n\nCollab Deal OS`,
    html: `<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:32px;color:#0f172a"><div style="max-width:560px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:28px"><p style="color:#7c3aed;font-weight:bold">COLLAB DEAL OS</p><h1 style="font-size:24px">${escapeHtml(subject)}</h1><p style="line-height:1.7">${escapeHtml(body)}</p><a href="${escapeHtml(url)}" style="display:inline-block;background:#7c3aed;color:white;padding:14px 20px;border-radius:10px;text-decoration:none">Open your account</a><p style="margin-top:28px;color:#64748b;font-size:12px">Your creator-brand collaboration workspace.</p></div></div>`,
  };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
