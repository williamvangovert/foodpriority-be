import { Router } from "express";
import multer from "multer";
import path from "path";
import { createDonation, getDonations, getMyDonations, updateDonationStatus, deleteDonation } from "../controllers/donationController";
import { authenticateToken } from "../middleware/auth";

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

const router = Router();

router.post("/", authenticateToken, upload.single("foto_makanan"), createDonation);
router.get("/", authenticateToken, getDonations);
router.get("/my", authenticateToken, getMyDonations);
router.put("/:id/status", authenticateToken, updateDonationStatus);
router.delete("/:id", authenticateToken, deleteDonation);

export default router;

