/**
 * CLI tool for generating an Argon2id password hash for SUPERADMIN_PASSWORD_HASH.
 *
 * Usage:
 *   npm run admin:hash -- <password>
 *   npm run admin:hash -- <password> --save
 *   npm run admin:hash -- --generate --save
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { hashPassword, verifyPassword, isValidArgonHash } from "../src/lib/crypto";

async function main() {
  const args = process.argv.slice(2);
  const shouldSave = args.includes("--save") || args.includes("--write");
  const shouldGenerate = args.includes("--generate");

  // Filter out flags to find the raw password argument
  const rawArgs = args.filter((arg) => !arg.startsWith("--"));
  let password = rawArgs[0];

  if (!password && shouldGenerate) {
    // Generate a strong, secure 16-character alphanumeric password
    password = crypto.randomBytes(12).toString("base64").replace(/[+/=]/g, "x") + "A1!";
  }

  if (!password) {
    console.error("==================================================");
    console.error("   NOEWBAR CS PRO - SUPERADMIN PASSWORD HASHER   ");
    console.error("==================================================");
    console.error("Error: Password minimal 8 karakter wajib disertakan.");
    console.error("");
    console.error("Contoh penggunaan:");
    console.error("  npm run admin:hash -- \"RahasiaSuper123!\"");
    console.error("  npm run admin:hash -- \"RahasiaSuper123!\" --save");
    console.error("  npm run admin:hash -- --generate --save");
    console.error("");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password minimal 8 karakter.");
    process.exit(1);
  }

  console.log("Generating Argon2id hash (m=19456 KiB, t=2, p=1)...");
  const hash = await hashPassword(password);

  const validPhc = isValidArgonHash(hash);
  const verifyCheck = await verifyPassword(password, hash);

  if (!validPhc || !verifyCheck) {
    console.error("Error: Hash verification failed internally.");
    process.exit(1);
  }

  console.log("--------------------------------------------------");
  console.log("Password Plaintext :", password);
  console.log("Argon2id Hash      :", hash);
  console.log("--------------------------------------------------");
  console.log("");
  console.log("Salin baris berikut ke file .env Anda:");
  console.log(`SUPERADMIN_PASSWORD_HASH="${hash}"`);
  console.log("");

  const hashEscaped = hash.replace(/\$/g, "\\$");

  if (shouldSave) {
    const envPath = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) {
      console.warn("Peringatan: File .env tidak ditemukan di root proyek.");
      return;
    }

    const envContent = fs.readFileSync(envPath, "utf-8");
    const targetPattern = /^SUPERADMIN_PASSWORD_HASH=.*$/m;

    let updatedEnv = "";
    if (targetPattern.test(envContent)) {
      updatedEnv = envContent.replace(
        targetPattern,
        `SUPERADMIN_PASSWORD_HASH="${hashEscaped}"`
      );
    } else {
      updatedEnv = envContent + `\nSUPERADMIN_PASSWORD_HASH="${hashEscaped}"\n`;
    }

    fs.writeFileSync(envPath, updatedEnv, "utf-8");
    console.log("SUKSES: File .env berhasil diperbarui secara otomatis!");
    console.log("CATATAN: Silakan restart dev/production server agar env baru dimuat.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
