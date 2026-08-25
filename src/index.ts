import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Routes imports
import authRoutes from "./routes/authRoutes";
import donationRoutes from "./routes/donationRoutes";
import claimRoutes from "./routes/claimRoutes";
import adminRoutes from "./routes/adminRoutes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Serve static uploaded food photos
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Wire up API routers
app.use("/api/auth", authRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/admin", adminRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "FoodPriority Backend is running!" });
});

app.listen(PORT, () => {
  console.log(`[server] Server is running on http://localhost:${PORT}`);
});
