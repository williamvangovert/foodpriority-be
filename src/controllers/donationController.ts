import { Response } from "express";
import pool from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { calculateSAWRanking } from "../services/sawService";

export const createDonation = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== "donor") {
    return res.status(403).json({ message: "Hanya donatur yang dapat menginput donasi makanan." });
  }

  const { nama_makanan, deskripsi, jumlah_porsi, latitude_donatur, longitude_donatur, batas_kadaluwarsa, kemasan } = req.body;
  const foto_makanan = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const result = await pool.query(
      `INSERT INTO "Donasi" (
        id_donatur, nama_makanan, deskripsi, foto_makanan, jumlah_porsi, 
        latitude_donatur, longitude_donatur, batas_kadaluwarsa, kemasan, status_donasi
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Tersedia')
       RETURNING *`,
      [
        req.user.id,
        nama_makanan,
        deskripsi,
        foto_makanan,
        parseInt(jumlah_porsi, 10),
        parseFloat(latitude_donatur),
        parseFloat(longitude_donatur),
        new Date(batas_kadaluwarsa),
        kemasan || "Baik"
      ]
    );

    res.status(201).json({
      message: "Donasi makanan berhasil didaftarkan!",
      donation: result.rows[0],
    });

  } catch (error: any) {
    console.error("Create donation error:", error);
    res.status(500).json({ message: "Gagal membuat donasi makanan.", error: error.message });
  }
};

export const getDonations = async (req: AuthRequest, res: Response) => {
  const { lat, lng } = req.query;

  try {
    if (lat && lng) {
      // Calculate distances and rank using the SAW service!
      const ranked = await calculateSAWRanking(parseFloat(lat as string), parseFloat(lng as string));
      return res.json(ranked);
    }

    // Default: List all available donations ordered by waktu_input desc
    const result = await pool.query(
      `SELECT d.*, u.nama_lengkap as nama_donatur, u.alamat as alamat_donatur 
       FROM "Donasi" d
       JOIN "User" u ON d.id_donatur = u.id
       WHERE d.status_donasi = 'Tersedia' AND d.jumlah_porsi > 0
       ORDER BY d.waktu_input DESC`
    );
    res.json(result.rows);

  } catch (error: any) {
    console.error("Get donations error:", error);
    res.status(500).json({ message: "Gagal mengambil daftar donasi makanan.", error: error.message });
  }
};

export const getMyDonations = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== "donor") {
    return res.status(403).json({ message: "Akses ditolak." });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM "Donasi" 
       WHERE id_donatur = $1 
       ORDER BY waktu_input DESC`,
      [req.user.id]
    );
    res.json(result.rows);

  } catch (error: any) {
    console.error("Get my donations error:", error);
    res.status(500).json({ message: "Gagal mengambil daftar donasi Anda.", error: error.message });
  }
};

export const updateDonationStatus = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Tidak terautentikasi." });
  }

  const { id } = req.params;
  const { status_donasi } = req.body; // 'Tersedia' | 'Sedang Diambil' | 'Sudah Diambil' | 'Selesai'

  try {
    // Verify ownership (unless admin)
    const donationCheck = await pool.query('SELECT * FROM "Donasi" WHERE id = $1', [id]);
    if (donationCheck.rows.length === 0) {
      return res.status(404).json({ message: "Donasi tidak ditemukan." });
    }

    const donation = donationCheck.rows[0];
    if (donation.id_donatur !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Anda tidak memiliki hak untuk mengubah donasi ini." });
    }

    // Normalize status: "Sudah Diambil" -> "Selesai", or keep "Dibatalkan", "Tersedia", "Sedang Diambil"
    const targetStatus = (status_donasi === "Sudah Diambil" || status_donasi === "Selesai") ? "Selesai" : status_donasi;

    const result = await pool.query(
      `UPDATE "Donasi" SET status_donasi = $1 
       WHERE id = $2 RETURNING *`,
      [targetStatus, id]
    );

    // If marked as Selesai / Sudah Diambil, also update associated claims that are in progress
    if (targetStatus === "Selesai") {
      await pool.query(
        `UPDATE "Transaksi_Klaim" SET status_klaim = 'Selesai' 
         WHERE id_donasi = $1 AND status_klaim IN ('Menunggu', 'Diambil', 'Sedang Diambil')`,
        [id]
      );
    }

    // If cancelled by donor, mark active claims as Dibatalkan
    if (targetStatus === "Dibatalkan") {
      await pool.query(
        `UPDATE "Transaksi_Klaim" SET status_klaim = 'Dibatalkan' 
         WHERE id_donasi = $1 AND status_klaim IN ('Menunggu', 'Diambil', 'Sedang Diambil')`,
        [id]
      );
    }

    res.json({
      message: targetStatus === "Dibatalkan" ? "Donasi makanan berhasil dibatalkan." : "Status donasi berhasil diperbarui!",
      donation: result.rows[0],
    });

  } catch (error: any) {
    console.error("Update donation status error:", error);
    res.status(500).json({ message: "Gagal memperbarui status donasi.", error: error.message });
  }
};

export const deleteDonation = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Tidak terautentikasi." });
  }

  const { id } = req.params;

  try {
    const donationCheck = await pool.query('SELECT * FROM "Donasi" WHERE id = $1', [id]);
    if (donationCheck.rows.length === 0) {
      return res.status(404).json({ message: "Donasi tidak ditemukan." });
    }

    const donation = donationCheck.rows[0];
    if (donation.id_donatur !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Anda tidak memiliki hak untuk menghapus donasi ini." });
    }

    await pool.query('DELETE FROM "Donasi" WHERE id = $1', [id]);

    res.json({ message: "Donasi makanan berhasil dihapus dari sistem." });
  } catch (error: any) {
    console.error("Delete donation error:", error);
    res.status(500).json({ message: "Gagal menghapus donasi.", error: error.message });
  }
};


