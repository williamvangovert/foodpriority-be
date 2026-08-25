import { Router } from "express";
import { getAdminStats, getUsers, verifyUser, updateSawWeights } from "../controllers/adminController";
import { authenticateToken, requireRole } from "../middleware/auth";

const router = Router();

// Only admin role allowed for these endpoints
router.get("/stats", authenticateToken, requireRole(["admin"]), getAdminStats);
router.get("/users", authenticateToken, requireRole(["admin"]), getUsers);
router.put("/users/:id/verify", authenticateToken, requireRole(["admin"]), verifyUser);
router.put("/saw-weights", authenticateToken, requireRole(["admin"]), updateSawWeights);

export default router;
