import pool from "../config/db";

export interface DonationItem {
  id: number;
  id_donatur: number;
  nama_makanan: string;
  deskripsi: string;
  foto_makanan: string | null;
  jumlah_porsi: number;
  latitude_donatur: number;
  longitude_donatur: number;
  waktu_input: Date;
  batas_kadaluwarsa: Date;
  status_donasi: string;
  kemasan: string;
  nama_donatur?: string;
  alamat_donatur?: string;
  jarak?: number;
  skor_saw?: number;
}

// Haversine formula to calculate distance in km
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Map packaging string to numerical value
const getPackagingValue = (packaging: string): number => {
  switch (packaging?.toLowerCase()) {
    case "tersegel":
      return 3;
    case "baik":
      return 2;
    case "cukup":
    default:
      return 1;
  }
};

export const calculateSAWRanking = async (
  recipientLat: number,
  recipientLng: number
): Promise<DonationItem[]> => {
  // 1. Fetch active donations
  const donationsResult = await pool.query(
    `SELECT d.*, u.nama_lengkap as nama_donatur, u.alamat as alamat_donatur 
     FROM "Donasi" d 
     JOIN "User" u ON d.id_donatur = u.id 
     WHERE d.status_donasi = 'Tersedia' AND d.jumlah_porsi > 0`
  );

  const donations: DonationItem[] = donationsResult.rows;

  if (donations.length === 0) {
    return [];
  }

  // 2. Fetch SAW criteria weights
  const weightsResult = await pool.query('SELECT * FROM "Pengaturan_SAW"');
  const criteria = weightsResult.rows;

  // Map criteria by name for easier lookup
  const weights: Record<string, { weight: number; type: "cost" | "benefit" }> = {};
  criteria.forEach((c) => {
    weights[c.nama_kriteria.toLowerCase()] = {
      weight: c.nilai_bobot,
      type: c.tipe.toLowerCase() as "cost" | "benefit",
    };
  });

  const now = new Date();

  // 3. Process each donation: calculate raw criteria values
  const processedDonations = donations.map((d) => {
    // Distance (cost: smaller is better)
    const distance = calculateDistance(
      recipientLat,
      recipientLng,
      Number(d.latitude_donatur),
      Number(d.longitude_donatur)
    );

    // Expiry hours remaining (cost: smaller is better)
    const expiryDate = new Date(d.batas_kadaluwarsa);
    const diffMs = expiryDate.getTime() - now.getTime();
    const expiryHours = Math.max(0.1, diffMs / (1000 * 60 * 60)); // min 0.1 hours to avoid division by zero

    return {
      ...d,
      jarak: Number(distance.toFixed(2)),
      criteriaValues: {
        jarak: Math.max(0.1, distance), // min 0.1 km to avoid division by zero
        kadaluwarsa: expiryHours,
      },
    };
  });

  // 4. Find Min & Max for normalization
  const minValues: Record<string, number> = { jarak: Infinity, kadaluwarsa: Infinity };
  const maxValues: Record<string, number> = { jarak: -Infinity, kadaluwarsa: -Infinity };

  processedDonations.forEach((d) => {
    Object.keys(d.criteriaValues).forEach((key) => {
      const val = d.criteriaValues[key as keyof typeof d.criteriaValues];
      if (val < minValues[key]) minValues[key] = val;
      if (val > maxValues[key]) maxValues[key] = val;
    });
  });

  // 5. Calculate SAW score for each item
  const rankedDonations = processedDonations.map((d) => {
    let score = 0;

    Object.keys(d.criteriaValues).forEach((key) => {
      const val = d.criteriaValues[key as keyof typeof d.criteriaValues];
      const criterionConf = weights[key];

      if (criterionConf) {
        let normalizedVal = 0;
        if (criterionConf.type === "cost") {
          normalizedVal = minValues[key] / val;
        } else {
          normalizedVal = val / maxValues[key] || 1; // Fallback to 1 if max is 0
        }
        score += normalizedVal * criterionConf.weight;
      }
    });

    return {
      ...d,
      skor_saw: Number(score.toFixed(4)),
    };
  });

  // 6. Sort by SAW score descending
  return rankedDonations.sort((a, b) => b.skor_saw - a.skor_saw);
};
