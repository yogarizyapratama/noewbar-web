import type { Metadata } from "next";
import { AuthPanel } from "@/app/dashboard/auth-panel";

export const metadata: Metadata = {
  title: "Daftar Akun Toko - Uji Coba Gratis 7 Hari | Noewbar CS Pro",
  description: "Daftar uji coba gratis 7 hari Noewbar CS Pro tanpa kartu kredit. Aktifkan bot customer service WhatsApp otomatis dan tingkatkan penjualan toko Anda.",
};

export default function RegisterPage() {
  return <AuthPanel initialMode="register" />;
}
