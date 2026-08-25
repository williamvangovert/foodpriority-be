import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import dotenv from "dotenv";

dotenv.config();

// Configure the Neon client to use ws for WebSocket connections
neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;
