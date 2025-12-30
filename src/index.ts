import "dotenv/config";
import express, { Request, Response } from "express";
import http from "node:http";
import cors from "cors";
import { initSocket } from "./config/socket.js";
import authRoutes from "./routes/auth.js";
import cameraRoutes from "./routes/cameras.js";
import { authenticateApiKey } from "./middleware/auth.js";

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();

// Créer le serveur HTTP pour Express + Socket.IO
const server = http.createServer(app);

// Initialiser Socket.IO
initSocket(server);

// Middleware CORS
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
      "X-Camera-API-Key",
    ],
  })
);

// Middleware
app.use(express.json());

// Routes publiques
app.use("/auth", authRoutes);

// Routes des caméras avec validation API Key
app.use("/cameras", authenticateApiKey, cameraRoutes);

// Route de santé
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "API actif", websocket: "enabled" });
});

// Gestion des erreurs 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// Démarrage du serveur HTTP (Express + Socket.IO)
server.listen(Number(PORT), HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`WebSocket ready on ws://${HOST}:${PORT}`);
});

export { app, server };
