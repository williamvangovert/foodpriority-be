import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { formatPhoneNumber, generateOtp, sendWhatsAppOtp } from "../services/whatsappService";

interface PendingRegistration {
  otp: string;
  expiresAt: number;
  resendAfter: number;
  attempts: number;
  userData: {
    fullName: string;
    username: string;
    address: string;
    phoneNumber: string;
    password: string;
    role: string;
  };
}

// In-memory store for pending OTP registrations (Key: formatted phone number)
const pendingRegistrations = new Map<string, PendingRegistration>();

/**
 * Step 1: Validate form, generate OTP, send via WhatsApp
 */
export const sendRegisterOtp = async (req: Request, res: Response) => {
  const { fullName, username, address, phoneNumber, password, role } = req.body;

  if (!fullName || !username || !phoneNumber || !password || !role) {
    return res.status(400).json({ message: "Semua kolom wajib diisi." });
  }

  const formattedPhone = formatPhoneNumber(phoneNumber);

  try {
    // 1. Check if username already exists
    const usernameCheck = await pool.query('SELECT id FROM "User" WHERE username = $1', [username.trim()]);
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ message: "Username sudah digunakan. Silakan gunakan username lain." });
    }

    // 2. Check if phone number already exists
    const phoneCheck = await pool.query('SELECT id FROM "User" WHERE no_hp = $1 OR no_hp = $2', [phoneNumber.trim(), formattedPhone]);
    if (phoneCheck.rows.length > 0) {
      return res.status(400).json({ message: "Nomor WhatsApp sudah terdaftar. Silakan langsung masuk atau gunakan nomor lain." });
    }

    // 3. Generate 6-digit OTP
    const otp = generateOtp();
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes
    const resendAfter = now + 60 * 1000; // 60 seconds cooldown

    pendingRegistrations.set(formattedPhone, {
      otp,
      expiresAt,
      resendAfter,
      attempts: 0,
      userData: {
        fullName: fullName.trim(),
        username: username.trim(),
        address: address?.trim() || "-",
        phoneNumber: phoneNumber.trim(),
        password,
        role
      }
    });

    // 4. Send OTP via WhatsApp
    const sendResult = await sendWhatsAppOtp(formattedPhone, otp);

    res.status(200).json({
      success: true,
      message: "Kode OTP verifikasi telah dikirimkan ke WhatsApp Anda.",
      phoneNumber: formattedPhone,
      method: sendResult.method
    });

  } catch (error: any) {
    console.error("sendRegisterOtp error:", error);
    res.status(500).json({ message: "Gagal memproses kode OTP.", error: error.message });
  }
};

/**
 * Step 2: Verify OTP and create user account
 */
export const verifyRegisterOtp = async (req: Request, res: Response) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    return res.status(400).json({ message: "Nomor telepon dan kode OTP harus diisi." });
  }

  const formattedPhone = formatPhoneNumber(phoneNumber);
  const pending = pendingRegistrations.get(formattedPhone);

  if (!pending) {
    return res.status(400).json({ 
      message: "Permintaan OTP tidak ditemukan atau telah kedaluwarsa. Silakan lakukan registrasi ulang." 
    });
  }

  const now = Date.now();

  // Check expiration
  if (now > pending.expiresAt) {
    pendingRegistrations.delete(formattedPhone);
    return res.status(400).json({ 
      message: "Kode OTP telah kedaluwarsa. Silakan klik 'Kirim Ulang OTP'." 
    });
  }

  // Check attempts
  if (pending.attempts >= 5) {
    pendingRegistrations.delete(formattedPhone);
    return res.status(400).json({ 
      message: "Terlalu banyak percobaan yang salah. Silakan lakukan pendaftaran dari awal." 
    });
  }

  // Check OTP match
  if (pending.otp.trim() !== otp.trim()) {
    pending.attempts += 1;
    return res.status(400).json({ 
      message: `Kode OTP salah. Sisa percobaan: ${5 - pending.attempts}` 
    });
  }

  // OTP is Valid! Create account in Database
  try {
    const { fullName, username, address, phoneNumber: rawPhone, password, role } = pending.userData;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user with status 'Terverifikasi'
    const result = await pool.query(
      `INSERT INTO "User" (role, username, password, nama_lengkap, alamat, no_hp, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Terverifikasi') 
       RETURNING id, role, username, nama_lengkap, alamat, no_hp, status`,
      [role, username, hashedPassword, fullName, address, rawPhone]
    );

    const user = result.rows[0];

    // Remove pending OTP
    pendingRegistrations.delete(formattedPhone);

    res.status(201).json({
      success: true,
      message: "Registrasi berhasil! Akun Anda telah aktif dan terverifikasi. Silakan masuk.",
      user: {
        id: user.id,
        role: user.role,
        username: user.username,
        nama_lengkap: user.nama_lengkap,
        no_hp: user.no_hp
      }
    });

  } catch (error: any) {
    console.error("verifyRegisterOtp error:", error);
    res.status(500).json({ message: "Gagal mendaftarkan akun.", error: error.message });
  }
};

/**
 * Resend OTP
 */
export const resendRegisterOtp = async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: "Nomor telepon harus diisi." });
  }

  const formattedPhone = formatPhoneNumber(phoneNumber);
  const pending = pendingRegistrations.get(formattedPhone);

  if (!pending) {
    return res.status(400).json({ message: "Sesi OTP telah berakhir. Silakan isi form pendaftaran kembali." });
  }

  const now = Date.now();
  if (now < pending.resendAfter) {
    const secondsRemaining = Math.ceil((pending.resendAfter - now) / 1000);
    return res.status(400).json({ 
      message: `Harap tunggu ${secondsRemaining} detik sebelum meminta kode OTP baru.` 
    });
  }

  // Generate new OTP
  const newOtp = generateOtp();
  pending.otp = newOtp;
  pending.expiresAt = now + 5 * 60 * 1000;
  pending.resendAfter = now + 60 * 1000;
  pending.attempts = 0;

  await sendWhatsAppOtp(formattedPhone, newOtp);

  res.json({
    success: true,
    message: "Kode OTP baru telah dikirimkan ke WhatsApp Anda."
  });
};

export const register = async (req: Request, res: Response) => {
  // Direct fallback register
  return sendRegisterOtp(req, res);
};

export const login = async (req: Request, res: Response) => {
  const { usernameOrPhone, password } = req.body;

  try {
    // Find user by username or phone number
    const result = await pool.query(
      'SELECT * FROM "User" WHERE username = $1 OR no_hp = $1',
      [usernameOrPhone]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Username/Nomor HP atau password salah." });
    }

    const user = result.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Username/Nomor HP atau password salah." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || "supersecretkeyfoodpriority123!",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login berhasil!",
      token,
      user: {
        id: user.id,
        role: user.role,
        username: user.username,
        nama_lengkap: user.nama_lengkap,
        alamat: user.alamat,
        no_hp: user.no_hp
      }
    });

  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Terjadi kesalahan server saat login.", error: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Tidak terautentikasi." });
  }

  try {
    const userResult = await pool.query(
      'SELECT id, role, username, nama_lengkap, alamat, no_hp, status, join_date FROM "User" WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    const user = userResult.rows[0];

    // Compute real account statistics
    let stats = {
      totalDonasi: 0,
      orangTerbantu: 0,
      donasiAktif: 0,
      totalKlaim: 0,
      klaimSelesai: 0,
      klaimAktif: 0,
      joinDate: user.join_date || new Date()
    };

    if (user.role === "donor") {
      const totalDonasiRes = await pool.query(
        'SELECT COALESCE(SUM(jumlah_porsi), 0) as total FROM "Donasi" WHERE id_donatur = $1',
        [user.id]
      );
      stats.totalDonasi = parseInt(totalDonasiRes.rows[0].total, 10);

      const donasiAktifRes = await pool.query(
        'SELECT COUNT(*) as count FROM "Donasi" WHERE id_donatur = $1 AND status_donasi = \'Tersedia\' AND jumlah_porsi > 0',
        [user.id]
      );
      stats.donasiAktif = parseInt(donasiAktifRes.rows[0].count, 10);

      const orangTerbantuRes = await pool.query(
        `SELECT COUNT(*) as count FROM "Transaksi_Klaim" tk
         JOIN "Donasi" d ON tk.id_donasi = d.id
         WHERE d.id_donatur = $1 AND tk.status_klaim = 'Selesai'`,
        [user.id]
      );
      stats.orangTerbantu = parseInt(orangTerbantuRes.rows[0].count, 10);
    } else if (user.role === "recipient") {
      const totalKlaimRes = await pool.query(
        'SELECT COUNT(*) as count FROM "Transaksi_Klaim" WHERE id_penerima = $1',
        [user.id]
      );
      stats.totalKlaim = parseInt(totalKlaimRes.rows[0].count, 10);

      const klaimSelesaiRes = await pool.query(
        'SELECT COUNT(*) as count FROM "Transaksi_Klaim" WHERE id_penerima = $1 AND status_klaim = \'Selesai\'',
        [user.id]
      );
      stats.klaimSelesai = parseInt(klaimSelesaiRes.rows[0].count, 10);

      const klaimAktifRes = await pool.query(
        'SELECT COUNT(*) as count FROM "Transaksi_Klaim" WHERE id_penerima = $1 AND status_klaim IN (\'Menunggu\', \'Diambil\')',
        [user.id]
      );
      stats.klaimAktif = parseInt(klaimAktifRes.rows[0].count, 10);
    } else if (user.role === "admin") {
      const totalDonasiRes = await pool.query('SELECT COALESCE(SUM(jumlah_porsi), 0) as total FROM "Donasi"');
      stats.totalDonasi = parseInt(totalDonasiRes.rows[0].total, 10);

      const totalUsersRes = await pool.query('SELECT COUNT(*) as count FROM "User"');
      stats.orangTerbantu = parseInt(totalUsersRes.rows[0].count, 10);

      const donasiAktifRes = await pool.query('SELECT COUNT(*) as count FROM "Donasi" WHERE status_donasi = \'Tersedia\' AND jumlah_porsi > 0');
      stats.donasiAktif = parseInt(donasiAktifRes.rows[0].count, 10);
    }

    res.json({
      ...user,
      stats
    });

  } catch (error: any) {
    console.error("GetMe error:", error);
    res.status(500).json({ message: "Terjadi kesalahan server.", error: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Tidak terautentikasi." });
  }

  const { fullName, address, phoneNumber, password } = req.body;

  try {
    let updateQuery = 'UPDATE "User" SET nama_lengkap = $1, alamat = $2, no_hp = $3';
    const queryParams: any[] = [fullName, address, phoneNumber, req.user.id];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += ', password = $4 WHERE id = $5';
      queryParams.splice(3, 0, hashedPassword); // Insert password hash before user ID
    } else {
      updateQuery += ' WHERE id = $4';
    }

    await pool.query(updateQuery, queryParams);

    res.json({ message: "Profil berhasil diperbarui!" });

  } catch (error: any) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Gagal memperbarui profil.", error: error.message });
  }
};
