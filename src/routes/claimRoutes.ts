import { Router } from "express";
import { createClaim, getMyClaims, updateClaimStatus } from "../controllers/claimController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.post("/", authenticateToken, createClaim);
router.get("/my", authenticateToken, getMyClaims);
router.put("/:id/status", authenticateToken, updateClaimStatus);

export default router;
