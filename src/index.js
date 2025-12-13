require("dotenv").config();
const express = require("express");
const pool = require("./config/database");
const authRoutes = require("./routes/auth");
const cameraRoutes = require("./routes/cameras");
const { authenticateApiKey } = require("./middleware/auth");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();

// Middleware
app.use(express.json());

// Routes publiques
app.use("/auth", authRoutes);

// Routes des caméras avec validation API Key
app.use("/cameras", authenticateApiKey, cameraRoutes);

// Route de santé
app.get("/health", (req, res) => {
  res.json({ status: "API actif" });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// Démarrage du serveur
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

module.exports = app;
