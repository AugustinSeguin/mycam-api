const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { emitNotification } = require("../config/socket");
const { authenticateToken, authenticateApiKey } = require("../middleware/auth");

// Créer une nouvelle caméra
router.post(
  "/create",
  authenticateToken,
  authenticateApiKey,
  async (req, res) => {
    try {
      const { nom, cam_key } = req.body;
      const userId = req.user.id;

      if (!nom || !cam_key) {
        return res.status(400).json({ error: "nom et cam_key sont requis." });
      }

      // Vérifier si la cam_key existe déjà
      const keyExists = await pool.query(
        "SELECT * FROM cameras WHERE cam_key = $1",
        [cam_key]
      );

      if (keyExists.rows.length > 0) {
        return res
          .status(400)
          .json({ error: "Cette cam_key est déjà utilisée." });
      }

      // Créer la caméra
      const result = await pool.query(
        "INSERT INTO cameras (nom, cam_key, created_by) VALUES ($1, $2, $3) RETURNING id, nom, cam_key",
        [nom, cam_key, userId]
      );

      const cameraId = result.rows[0].id;

      // Ajouter l'utilisateur créateur à la caméra (relation many-to-many)
      await pool.query(
        "INSERT INTO user_cameras (user_id, camera_id) VALUES ($1, $2)",
        [userId, cameraId]
      );

      res.status(201).json({
        message: "Caméra créée avec succès",
        camera: result.rows[0],
      });
    } catch (error) {
      console.error("Erreur lors de la création de la caméra:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// Vidéo en temps réel (placeholders pour les flux vidéo réels)
router.get("/video/:cam_key", async (req, res) => {
  try {
    const { cam_key } = req.params;

    // Vérifier que la caméra existe
    const camera = await pool.query(
      "SELECT * FROM cameras WHERE cam_key = $1",
      [cam_key]
    );

    if (camera.rows.length === 0) {
      return res.status(404).json({ error: "Caméra non trouvée." });
    }

    // Pour un vrai flux MJPEG, vous devriez se connecter à la caméra ESP32
    // Ceci est un placeholder simple
    res.setHeader("Content-Type", "application/json");
    res.json({
      message: "Flux vidéo en temps réel",
      cam_key: cam_key,
      camera: camera.rows[0],
      status: "streaming",
    });
  } catch (error) {
    console.error("Erreur lors de l'accès au flux vidéo:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour les notifications (POST)
router.post("/notification/:cam_key", async (req, res) => {
  try {
    const { cam_key } = req.params;
    const { type, message, timestamp } = req.body;

    if (!type || !message) {
      return res.status(400).json({ error: "type et message sont requis." });
    }

    // Vérifier que la caméra existe, sinon la créer automatiquement
    let camera = await pool.query("SELECT * FROM cameras WHERE cam_key = $1", [
      cam_key,
    ]);

    if (camera.rows.length === 0) {
      // Créer automatiquement la caméra si elle n'existe pas
      camera = await pool.query(
        "INSERT INTO cameras (nom, cam_key) VALUES ($1, $2) RETURNING *",
        [`Auto-created camera ${cam_key}`, cam_key]
      );
      console.log(`[INFO] Caméra auto-créée: ${cam_key}`);
    }

    // Convertir le timestamp Unix en Date si fourni
    let createdAt;
    if (timestamp) {
      // Si c'est un nombre (Unix timestamp en secondes)
      if (typeof timestamp === "number") {
        createdAt = new Date(timestamp * 1000); // Convertir en millisecondes
      } else {
        createdAt = new Date(timestamp);
      }
    } else {
      createdAt = new Date();
    }

    // Stocker la notification en base de données
    const result = await pool.query(
      "INSERT INTO notifications (camera_id, type, message, created_at) VALUES ($1, $2, $3, $4) RETURNING id, type, message, created_at",
      [camera.rows[0].id, type, message, createdAt]
    );

    // Émettre la notification en temps réel via Socket.IO
    emitNotification(cam_key, {
      id: result.rows[0].id,
      type: result.rows[0].type,
      message: result.rows[0].message,
      cameraName: camera.rows[0].nom,
      createdAt: result.rows[0].created_at,
    });

    res.status(201).json({
      message: "Notification enregistrée et envoyée en temps réel",
      notification: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la notification:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Récupérer les caméras de l'utilisateur
router.get("/my-cameras", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT c.id, c.nom, c.cam_key FROM cameras c
       JOIN user_cameras uc ON c.id = uc.camera_id
       WHERE uc.user_id = $1`,
      [userId]
    );

    res.json({
      cameras: result.rows,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des caméras:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
