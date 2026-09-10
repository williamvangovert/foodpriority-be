import { Response } from "express";
import pool from "../config/db";
import { AuthRequest } from "../middleware/auth";

export const getAdminStats = async (req: AuthRequest, res: Response) => {
  try {
    // 1. Total donations
    const donationsCountResult = await pool.query('SELECT COUNT(*) FROM "Donasi"');
    const totalDonations = parseInt(donationsCountResult.rows[0].count, 10);

    // 2. Total portions distributed (weight)
    const weightResult = await pool.query('SELECT SUM(jumlah_porsi) FROM "Donasi"');
    const totalWeight = parseInt(weightResult.rows[0].sum || "0", 10);

    // 3. User distribution
    const usersCountResult = await pool.query(
      `SELECT role, COUNT(*) as count 
       FROM "User" 
       WHERE role != 'admin' 
       GROUP BY role`
    );
    let donorCount = 0;
    let recipientCount = 0;
    usersCountResult.rows.forEach((row) => {
      if (row.role === "donor") donorCount = parseInt(row.count, 10);
      if (row.role === "recipient") recipientCount = parseInt(row.count, 10);
    });

    // 4. Pending users for verification
    const pendingUsersResult = await pool.query(
      `SELECT id, nama_lengkap as name, username, role, status, join_date as "joinDate"
       FROM "User" 
       WHERE status = 'Menunggu' 
       ORDER BY join_date DESC`
    );

    // 5. Daily donations stats (last 7 entries)
    const dailyDonationsResult = await pool.query(
      `SELECT TO_CHAR(waktu_input, 'DD Mon') as date, COUNT(*) as donations, COALESCE(SUM(jumlah_porsi), 0) as weight
       FROM "Donasi"
       GROUP BY TO_CHAR(waktu_input, 'DD Mon'), DATE(waktu_input)
       ORDER BY DATE(waktu_input) ASC
       LIMIT 7`
    );

    // 6. Location-based stats
    const locationStatsResult = await pool.query(
      `SELECT COALESCE(alamat, 'Lainnya') as location, COUNT(DISTINCT d.id) as donations, COUNT(DISTINCT u.id) as users
       FROM "User" u
       LEFT JOIN "Donasi" d ON d.id_donatur = u.id
       WHERE u.role != 'admin'
       GROUP BY u.alamat
       LIMIT 5`
    );

    // 7. SAW weights configuration
    const sawWeightsResult = await pool.query('SELECT * FROM "Pengaturan_SAW"');

    // 8. Real Social Impact Report & Breakdown from Database
    const donationsRes = await pool.query('SELECT nama_makanan, jumlah_porsi FROM "Donasi"');
    const categories: { [key: string]: number } = {};
    let totalAllPortions = 0;

    donationsRes.rows.forEach((row) => {
      const name = (row.nama_makanan || "").toLowerCase();
      const porsi = parseInt(row.jumlah_porsi, 10) || 0;
      totalAllPortions += porsi;

      let cat = "Makanan Lainnya";
      if (/nasi|ayam|daging|ikan|soto|bakso|siomay|batagor|mie|pasta|rendang|gulai|sate|sop|sayur matang/.test(name)) {
        cat = "Makanan Siap Saji & Lauk";
      } else if (/roti|kue|cake|donat|bolu|bakery|pastry|biskuit/.test(name)) {
        cat = "Roti & Produk Olahan Gandum";
      } else if (/apel|pisang|jeruk|mangga|buah|sayur|tomat|wortel|bayam|kangkung|salada/.test(name)) {
        cat = "Buah & Sayuran Segar";
      } else if (/beras|biji|jagung|gandum|kedelai|kacang/.test(name)) {
        cat = "Bahan Pokok & Serealia";
      } else if (/susu|yogurt|keju|mentega|kopi|teh|jus|minuman/.test(name)) {
        cat = "Minuman & Produk Susu";
      } else if (/kaleng|sarden|kornet/.test(name)) {
        cat = "Makanan Olahan & Kaleng";
      }

      categories[cat] = (categories[cat] || 0) + porsi;
    });

    // Standard conversion factor: 1 portion = 0.25 kg (250 grams)
    const KG_PER_PORTION = 0.25;
    const totalKg = Math.round(totalAllPortions * KG_PER_PORTION * 10) / 10;

    const foodBreakdown = Object.entries(categories).map(([type, portions]) => ({
      type,
      portions,
      weight: Math.round(portions * KG_PER_PORTION * 10) / 10,
      percentage: totalAllPortions > 0 ? Math.round((portions / totalAllPortions) * 100) : 0,
    })).sort((a, b) => b.portions - a.portions);

    // Unique claimants / people impacted
    const claimantsRes = await pool.query('SELECT COUNT(DISTINCT id_penerima) as count FROM "Transaksi_Klaim"');
    const uniqueClaimants = parseInt(claimantsRes.rows[0]?.count || "0", 10);
    // If no claims yet, reflect registered recipient count
    const peopleImpacted = uniqueClaimants > 0 ? uniqueClaimants : recipientCount;

    // Environmental calculations based on standard FAO & IPCC conversion factors:
    // - 2.5 kg CO2e saved per 1 kg food waste diverted from landfills
    // - 500 L virtual water footprint saved per 1 kg food rescued
    const wastePreventedKg = totalKg;
    const co2SavedKg = Math.round(totalKg * 2.5 * 10) / 10;
    const waterSavedLiter = Math.round(totalKg * 500);

    const socialImpact = {
      totalFoodDistributedKg: totalKg,
      totalPortionsServed: totalAllPortions,
      peopleImpacted: peopleImpacted,
      foodBreakdown,
      environmentalImpact: {
        wastePreventedKg,
        co2SavedKg,
        waterSavedLiter,
      },
    };

    res.json({
      stats: {
        totalDonations,
        totalWeight,
        totalUsers: donorCount + recipientCount,
        donorCount,
        recipientCount,
      },
      pendingUsers: pendingUsersResult.rows,
      dailyDonations: dailyDonationsResult.rows,
      locationStats: locationStatsResult.rows,
      sawWeights: sawWeightsResult.rows,
      socialImpact,
    });

  } catch (error: any) {
    console.error("Get admin stats error:", error);
    res.status(500).json({ message: "Gagal mengambil statistik admin.", error: error.message });
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nama_lengkap as name, u.username, u.no_hp, u.alamat, u.role, u.status, u.join_date as "joinDate",
              COUNT(d.id) as donations
       FROM "User" u
       LEFT JOIN "Donasi" d ON d.id_donatur = u.id
       WHERE u.role != 'admin'
       GROUP BY u.id, u.nama_lengkap, u.username, u.no_hp, u.alamat, u.role, u.status, u.join_date
       ORDER BY u.join_date DESC`
    );
    res.json(result.rows);

  } catch (error: any) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Gagal mengambil daftar pengguna.", error: error.message });
  }
};

export const verifyUser = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // 'Terverifikasi' | 'Ditolak'

  try {
    const result = await pool.query(
      `UPDATE "User" SET status = $1 
       WHERE id = $2 RETURNING id, username, nama_lengkap, status`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan." });
    }

    res.json({
      message: `Status pengguna berhasil diperbarui menjadi ${status}!`,
      user: result.rows[0],
    });

  } catch (error: any) {
    console.error("Verify user error:", error);
    res.status(500).json({ message: "Gagal memverifikasi pengguna.", error: error.message });
  }
};

export const updateSawWeights = async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Hanya admin yang dapat mengkonfigurasi bobot SAW." });
  }

  const { weights } = req.body; // Expects object: { jarak: 0.4, kadaluwarsa: 0.35, jumlah: 0.15, kemasan: 0.1 }

  try {
    const sum = Object.values(weights).reduce((acc: number, val: any) => acc + Number(val), 0);
    // Tolerance for floating point precision: sum must be exactly 1.0 (or close, e.g. 0.9999 to 1.0001)
    if (Math.abs(sum - 1) > 0.001) {
      return res.status(400).json({ message: `Total bobot harus sama dengan 100% (saat ini ${Math.round(sum * 100)}%).` });
    }

    await pool.query("BEGIN");

    for (const [name, val] of Object.entries(weights)) {
      await pool.query(
        `UPDATE "Pengaturan_SAW" 
         SET nilai_bobot = $1, id_admin = $2 
         WHERE LOWER(nama_kriteria) = $3`,
        [Number(val), req.user.id, name.toLowerCase()]
      );
    }

    await pool.query("COMMIT");

    res.json({ message: "Konfigurasi bobot kriteria SAW berhasil diperbarui!" });

  } catch (error: any) {
    await pool.query("ROLLBACK");
    console.error("Update SAW weights error:", error);
    res.status(500).json({ message: "Gagal memperbarui bobot kriteria.", error: error.message });
  }
};
