const jwt = require("jsonwebtoken");

// Middleware pour vérifier le JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Accès refusé. Token manquant." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token invalide ou expiré." });
    }
    req.user = user;
    next();
  });
};

// Middleware pour vérifier l'API Key
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "API Key invalide." });
  }

  next();
};

// Middleware pour vérifier la Camera API Key (pour l'enregistrement)
const authenticateCameraApiKey = (req, res, next) => {
  const cameraApiKey = req.headers["x-camera-api-key"];

  if (!cameraApiKey || cameraApiKey !== process.env.CAMERA_API_KEY) {
    return res.status(401).json({ error: "Camera API Key invalide." });
  }

  next();
};

module.exports = {
  authenticateToken,
  authenticateApiKey,
  authenticateCameraApiKey,
};
