import { Response } from "express";
import pool from "../config/db";
import { AuthRequest } from "../middleware/auth";

export const createClaim = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== "recipient") {
    return res.status(403).json({ message: "Hanya penerima yang dapat mengklaim donasi makanan." });
  }

  const { id_donasi, jarak_antar_lokasi, skor_saw } = req.body;

  try {
    // Start transaction
    await pool.query("BEGIN");

    // Check donation availability
    const donationCheck = await pool.query(
      'SELECT * FROM "Donasi" WHERE id = $1 FOR UPDATE',
      [id_donasi]
    );

    if (donationCheck.rows.length === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ message: "Donasi makanan tidak ditemukan." });
    }

    const donation = donationCheck.rows[0];
    if (donation.status_donasi === "Selesai" || donation.jumlah_porsi <= 0) {
      await pool.query("ROLLBACK");
      return res.status(400).json({ message: "Makanan ini sudah habis atau selesai disalurkan." });
    }

    // Decrement portion by 1
    const newPortions = donation.jumlah_porsi - 1;
    const newStatus = newPortions === 0 ? "Selesai" : "Sedang Diambil";

    await pool.query(
      'UPDATE "Donasi" SET jumlah_porsi = $1, status_donasi = $2 WHERE id = $3',
      [newPortions, newStatus, id_donasi]
    );

    // Create Transaksi_Klaim record
    const result = await pool.query(
      `INSERT INTO "Transaksi_Klaim" (
        id_donasi, id_penerima, jarak_antar_lokasi, skor_saw, status_klaim
      )
       VALUES ($1, $2, $3, $4, 'Menunggu')
       RETURNING *`,
      [id_donasi, req.user.id, parseFloat(jarak_antar_lokasi), parseFloat(skor_saw)]
    );

    await pool.query("COMMIT");

    res.status(201).json({
      message: "Makanan berhasil diklaim! Silakan ambil ke lokasi donatur.",
      claim: result.rows[0],
    });

  } catch (error: any) {
    await pool.query("ROLLBACK");
    console.error("Create claim error:", error);
    res.status(500).json({ message: "Gagal memproses klaim makanan.", error: error.message });
  }
};

export const getMyClaims = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Tidak terautentikasi." });
  }

  try {
    let result;
    if (req.user.role === "recipient") {
      // Recipient gets their claims
      result = await pool.query(
        `SELECT tk.*, d.nama_makanan, d.foto_makanan, d.deskripsi, d.kemasan, u.nama_lengkap as nama_donatur, u.alamat as alamat_donatur, u.no_hp as no_hp_donatur
         FROM "Transaksi_Klaim" tk
         JOIN "Donasi" d ON tk.id_donasi = d.id
         JOIN "User" u ON d.id_donatur = u.id
         WHERE tk.id_penerima = $1
         ORDER BY tk.waktu_klaim DESC`,
        [req.user.id]
      );
    } else {
      // Donor gets claims made on their donations
      result = await pool.query(
        `SELECT tk.*, d.nama_makanan, d.foto_makanan, d.deskripsi, d.kemasan, u.nama_lengkap as nama_penerima, u.alamat as alamat_penerima, u.no_hp as no_hp_penerima
         FROM "Transaksi_Klaim" tk
         JOIN "Donasi" d ON tk.id_donasi = d.id
         JOIN "User" u ON tk.id_penerima = u.id
         WHERE d.id_donatur = $1
         ORDER BY tk.waktu_klaim DESC`,
        [req.user.id]
      );
    }

    res.json(result.rows);

  } catch (error: any) {
    console.error("Get claims error:", error);
    res.status(500).json({ message: "Gagal mengambil daftar klaim.", error: error.message });
  }
};

export const updateClaimStatus = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Tidak terautentikasi." });
  }

  const { id } = req.params;
  const { status_klaim } = req.body; // 'Menunggu' | 'Diambil' | 'Selesai' | 'Dibatalkan'

  try {
    // Get claim details
    const claimResult = await pool.query(
      `SELECT tk.*, d.id_donatur, d.jumlah_porsi, d.status_donasi 
       FROM "Transaksi_Klaim" tk
       JOIN "Donasi" d ON tk.id_donasi = d.id
       WHERE tk.id = $1`,
      [id]
    );

    if (claimResult.rows.length === 0) {
      return res.status(404).json({ message: "Transaksi klaim tidak ditemukan." });
    }

    const claim = claimResult.rows[0];

    // Ownership checks:
    // - Recipients can cancel ('Dibatalkan') their own claims.
    // - Donors can accept/complete ('Diambil', 'Selesai') claims on their donations.
    if (status_klaim === "Dibatalkan" && claim.id_penerima !== req.user.id) {
      return res.status(403).json({ message: "Anda hanya dapat membatalkan klaim Anda sendiri." });
    }

    if (
      (status_klaim === "Diambil" || status_klaim === "Selesai") &&
      claim.id_donatur !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Hanya donatur atau admin yang dapat menyetujui klaim ini." });
    }

    // Process status update
    await pool.query("BEGIN");

    // If claim is canceled, restore the portion count in Donasi
    if (status_klaim === "Dibatalkan" && claim.status_klaim !== "Dibatalkan") {
      const restoredPortions = claim.jumlah_porsi + 1;
      await pool.query(
        'UPDATE "Donasi" SET jumlah_porsi = $1, status_donasi = \'Tersedia\' WHERE id = $2',
        [restoredPortions, claim.id_donasi]
      );
    }

    // If claim is completed, set status_donasi to 'Selesai' if portions are 0
    if (status_klaim === "Selesai" && claim.jumlah_porsi === 0) {
      await pool.query(
        'UPDATE "Donasi" SET status_donasi = \'Selesai\' WHERE id = $1',
        [claim.id_donasi]
      );
    }

    const updatedClaim = await pool.query(
      `UPDATE "Transaksi_Klaim" SET status_klaim = $1 
       WHERE id = $2 RETURNING *`,
      [status_klaim, id]
    );

    await pool.query("COMMIT");

    res.json({
      message: "Status klaim berhasil diperbarui!",
      claim: updatedClaim.rows[0],
    });

  } catch (error: any) {
    await pool.query("ROLLBACK");
    console.error("Update claim status error:", error);
    res.status(500).json({ message: "Gagal memperbarui status klaim.", error: error.message });
  }
};

export const getClaimById = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Tidak terautentikasi." });
  }

  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT tk.*, 
              d.nama_makanan, d.foto_makanan, d.deskripsi, d.kemasan, d.batas_kadaluwarsa,
              d.latitude_donatur, d.longitude_donatur, d.id_donatur,
              u.nama_lengkap as nama_donatur, u.alamat as alamat_donatur, u.no_hp as no_hp_donatur,
              rec.nama_lengkap as nama_penerima, rec.alamat as alamat_penerima, rec.no_hp as no_hp_penerima
       FROM "Transaksi_Klaim" tk
       JOIN "Donasi" d ON tk.id_donasi = d.id
       JOIN "User" u ON d.id_donatur = u.id
       JOIN "User" rec ON tk.id_penerima = rec.id
       WHERE tk.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Klaim tidak ditemukan." });
    }

    const claim = result.rows[0];

    // Security check: recipient or donor or admin
    if (
      claim.id_penerima !== req.user.id &&
      claim.id_donatur !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Anda tidak memiliki akses ke detail klaim ini." });
    }

    res.json(claim);

  } catch (error: any) {
    console.error("Get claim by ID error:", error);
    res.status(500).json({ message: "Gagal mengambil detail klaim.", error: error.message });
  }
};
