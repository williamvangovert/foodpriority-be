/**
 * WhatsApp Gateway Service for FoodPriority
 * Supports Fonnte / WhatsApp REST Gateway API and local simulation fallback
 */

export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, "");

  // Convert leading 0 to 62
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned;
  }

  return cleaned;
};

export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendWhatsAppOtp = async (
  rawPhone: string,
  otp: string
): Promise<{ success: boolean; message: string; method: "api" | "simulation" }> => {
  const formattedPhone = formatPhoneNumber(rawPhone);
  const fonnteToken = process.env.FONNTE_TOKEN || process.env.WA_TOKEN;

  const messageText = `Halo! Terima kasih telah mendaftar di *FoodPriority*.\n\nBerikut adalah kode verifikasi OTP Anda:\n\n👉 *${otp}*\n\nKode ini berlaku selama *5 menit*. Jangan bagikan kode ini kepada siapa pun demi keamanan akun Anda.\n\nSalam hangat,\n*Tim FoodPriority*`;

  // 1. If Fonnte / Gateway Token is provided in .env
  if (fonnteToken) {
    try {
      const response = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          Authorization: fonnteToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: formattedPhone,
          message: messageText,
          countryCode: "62",
        }),
      });

      const data = (await response.json()) as any;

      if (data?.status) {
        console.log(`[WhatsApp Gateway] OTP berhasil dikirim via Fonnte ke ${formattedPhone}`);
        return { success: true, message: "Kode OTP berhasil dikirim ke WhatsApp Anda.", method: "api" };
      } else {
        console.warn(`[WhatsApp Gateway API Warning]:`, data);
      }
    } catch (err) {
      console.error(`[WhatsApp Gateway API Error]:`, err);
    }
  }

  // 2. Simulated OTP fallback (prints prominently in terminal for development & testing)
  console.log(`\n==================================================`);
  console.log(`📱 [WHATSAPP OTP SIMULATION]`);
  console.log(`Nomor Tujuan : +${formattedPhone} (${rawPhone})`);
  console.log(`Kode OTP     : >>> ${otp} <<<`);
  console.log(`Waktu Berlaku: 5 Menit`);
  console.log(`==================================================\n`);

  return {
    success: true,
    message: "Kode OTP telah dikirimkan ke nomor WhatsApp Anda.",
    method: "simulation",
  };
};
