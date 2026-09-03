import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db";
import { AuthRequest } from "../middleware/auth";

export const register = async (req: Request, res: Response) => {
  const { fullName, username, address, phoneNumber, password, role } = req.body;

  try {
    // Check if user already exists
    const userCheck = await pool.query('SELECT * FROM "User" WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: "Username sudah digunakan." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user (default status is 'Terverifikasi' for recipients/admins, 'Menunggu' for donors)
    const status = role === "donor" ? "Menunggu" : "Terverifikasi";
    const result = await pool.query(
      `INSERT INTO "User" (role, username, password, nama_lengkap, alamat, no_hp, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, role, username, nama_lengkap, alamat, no_hp, status`,
      [role, username, hashedPassword, fullName, address, phoneNumber, status]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || "supersecretkeyfoodpriority123!",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Registrasi berhasil!",
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
    console.error("Register error:", error);
    res.status(500).json({ message: "Terjadi kesalahan server saat registrasi.", error: error.message });
  }
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
