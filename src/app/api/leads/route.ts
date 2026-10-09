import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sendTelegramLeadNotification } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, businessName, whatsapp, serviceInterest, notes } = body;

    if (!name || !businessName || !whatsapp || !serviceInterest) {
      return NextResponse.json(
        { error: 'Semua kolom bertanda bintang wajib diisi.' },
        { status: 400 }
      );
    }

    // Clean phone number
    const cleanPhone = whatsapp.trim().replace(/[^0-9+]/g, '');

    // Insert into PostgreSQL noewbar_db
    const query = `
      INSERT INTO leads (name, business_name, whatsapp, service_interest, notes, status)
      VALUES ($1, $2, $3, $4, $5, 'NEW')
      RETURNING id, created_at
    `;
    const values = [name.trim(), businessName.trim(), cleanPhone, serviceInterest, notes?.trim() || null];
    const result = await pool.query(query, values);
    const newLead = result.rows[0];

    // Trigger instant Telegram alert in background
    sendTelegramLeadNotification({
      name: name.trim(),
      businessName: businessName.trim(),
      whatsapp: cleanPhone,
      serviceInterest,
      notes: notes?.trim(),
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      message: 'Permintaan konsultasi berhasil dikirim. Tim kami akan segera menghubungi via WhatsApp.',
      leadId: newLead.id,
    });
  } catch (error) {
    console.error('API /leads error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan sistem saat menyimpan permintaan. Silakan hubungi via WhatsApp langsung.' },
      { status: 500 }
    );
  }
}
