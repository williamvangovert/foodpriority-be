import { Router } from "express";
import { register, login, getMe, updateProfile } from "../controllers/authController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticateToken, getMe);
router.put("/profile", authenticateToken, updateProfile);

export default router;
