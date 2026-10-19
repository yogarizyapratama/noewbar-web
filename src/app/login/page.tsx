import type { Metadata } from "next";
import { AuthPanel } from "@/app/dashboard/auth-panel";

export const metadata: Metadata = {
  title: "Masuk ke Dashboard Toko | Noewbar CS Pro",
  description: "Masuk ke akun toko Noewbar CS Pro Anda untuk mengelola bot WhatsApp, katalog produk, dan pesanan pelanggan.",
};

export default function LoginPage() {
  return <AuthPanel initialMode="login" />;
}
