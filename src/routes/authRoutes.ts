import { Router } from "express";
import { register, login, getMe, updateProfile, sendRegisterOtp, verifyRegisterOtp, resendRegisterOtp } from "../controllers/authController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/send-register-otp", sendRegisterOtp);
router.post("/verify-register-otp", verifyRegisterOtp);
router.post("/resend-otp", resendRegisterOtp);
router.post("/login", login);
router.get("/me", authenticateToken, getMe);
router.put("/profile", authenticateToken, updateProfile);

export default router;
