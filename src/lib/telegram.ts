export async function sendTelegramLeadNotification(data: {
  name: string;
  businessName: string;
  whatsapp: string;
  serviceInterest: string;
  notes?: string;
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '8808140091:AAE01z0PiYtidKHL_UxDLik_qulC9ICbibY';
  const chatId = process.env.TELEGRAM_CHAT_ID || '992928836';

  const message = `🚨 <b>KONSULTASI BARU DARI WEBSITE NOEWBAR!</b>

👤 <b>Nama:</b> ${escapeHtml(data.name)}
🏢 <b>Bisnis:</b> ${escapeHtml(data.businessName)}
📱 <b>WhatsApp:</b> <a href="https://wa.me/${data.whatsapp.replace(/\D/g, '')}">${escapeHtml(data.whatsapp)}</a>
🎯 <b>Solusi Diminati:</b> <code>${escapeHtml(data.serviceInterest)}</code>
📝 <b>Catatan Masalah:</b> ${data.notes ? escapeHtml(data.notes) : '-'}

⏰ <i>Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</i>`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch (error) {
    console.error('Error sending Telegram alert:', error);
    return false;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
