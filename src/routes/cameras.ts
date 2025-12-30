import express, { Response } from "express";
import pool from "../config/database";
import { emitNotification } from "../config/socket";
import {
  authenticateToken,
  authenticateApiKey,
  authenticateCameraApiKey,
} from "../middleware/auth";
import { AuthenticatedRequest } from "../types";

const router = express.Router();

// Heartbeat dynamique : mise à jour de l'IP publique de la caméra
router.post("/update-ip", authenticateCameraApiKey, async (req, res) => {
  try {
    const { cam_key, local_ip } = req.body;
    
    // 1. Déterminer l'IP à enregistrer
    let rawIp = local_ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    
    // 2. Nettoyage robuste
    let ipToSave = Array.isArray(rawIp) ? rawIp[0] : rawIp.split(',')[0].trim();
    
    if (ipToSave.includes('::ffff:')) {
      ipToSave = ipToSave.replace('::ffff:', '');
    }

    console.log(`[HEARTBEAT] Caméra ${cam_key} -> IP : ${ipToSave}`);

    // 3. Exécution avec vérification
    const result = await pool.query(
      "UPDATE cameras SET ip_address = $1 WHERE cam_key = $2",
      [ipToSave, cam_key]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Caméra non trouvée en base de données." });
    }

    res.status(200).send("IP mise à jour");
  } catch (error) {
    console.error("Erreur serveur Heartbeat:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Créer une nouvelle caméra
router.post(
  "/create",
  authenticateToken,
  authenticateApiKey,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name, cam_key } = req.body;
      const userId = req.user!.id;

      if (!name || !cam_key) {
        res.status(400).json({ error: "name et cam_key sont requis." });
        return;
      }

      // Vérifier si la cam_key existe déjà
      const keyExists = await pool.query(
        "SELECT * FROM cameras WHERE cam_key = $1",
        [cam_key]
      );

      if (keyExists.rows.length > 0) {
        res.status(400).json({ error: "Cette cam_key est déjà utilisée." });
        return;
      }

      // Créer la caméra
      const result = await pool.query(
        "INSERT INTO cameras (name, cam_key, created_by) VALUES ($1, $2, $3) RETURNING id, name, cam_key",
        [name, cam_key, userId]
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
import http from "node:http";
import https from "node:https";

router.get(
  "/video/:cam_key",
  // authenticateToken,
  // authenticateApiKey,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { cam_key } = req.params;

      // 1. Récupérer les infos de la caméra
      const camera = await pool.query(
        "SELECT * FROM cameras WHERE cam_key = $1",
        [cam_key]
      );

      if (camera.rows.length === 0) {
        res.status(404).json({ error: "Caméra non trouvée." });
        return;
      }

      const cam = camera.rows[0];
      if (!cam.ip_address) {
        res.status(400).json({ error: "Adresse IP de la caméra manquante." });
        return;
      }

      // 2. Préparation du Proxy vers l'ESP32
      const espUrl = `http://${cam.ip_address}/stream`;
      const CAMERA_API_KEY =
        process.env.CAMERA_API_KEY ||
        "CamRegister_7f9a2b5e8c1d4a6b93e0f2d1c5b8a472";

      console.log(`[STREAM] Tentative de connexion à: ${espUrl}`);

      const client = espUrl.startsWith("https") ? https : http;

      const proxyReq = client.get(
        espUrl,
        {
          headers: {
            "X-Camera-API-Key": CAMERA_API_KEY,
          },
          timeout: 10000, // Timeout de 10s si l'ESP ne répond pas
        },
        (proxyRes) => {
          // Si l'ESP32 répond une erreur (ex: 401 ou 404)
          if (proxyRes.statusCode !== 200) {
            console.error(
              `[STREAM] L'ESP32 a renvoyé un code ${proxyRes.statusCode}`
            );
            res
              .status(proxyRes.statusCode || 502)
              .json({ error: "La caméra a refusé la connexion." });
            return;
          }

          // 3. Configuration des Headers de Streaming
          // On force le content-type MJPEG avec le boundary standard
          res.setHeader(
            "Content-Type",
            "multipart/x-mixed-replace; boundary=123456789000000000000987654321"
          );

          // Désactivation totale du cache pour éviter les lags
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");

          // Important pour ngrok et les proxys (évite le buffering)
          res.setHeader("X-Accel-Buffering", "no");
          res.setHeader("Connection", "keep-alive");

          console.log(`[STREAM] Flux démarré pour ${cam_key}`);

          // 4. Pipe direct : On transmet les octets tels quels
          proxyRes.pipe(res);

          // Nettoyage si le client ferme la page
          req.on("close", () => {
            console.log(`[STREAM] Connexion fermée par l'utilisateur.`);
            proxyRes.destroy();
          });
        }
      );

      proxyReq.on("error", (err) => {
        console.error("[STREAM] Erreur Proxy:", err.message);
        if (!res.headersSent) {
          res
            .status(502)
            .json({ error: "Caméra injoignable (Vérifiez l'IP ou le VPN)" });
        }
      });
    } catch (error) {
      console.error("[STREAM] Erreur Serveur:", error);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "Erreur interne du serveur de streaming" });
      }
    }
  }
);
// Route pour les notifications (POST)
router.post(
  "/notification/:cam_key",
  authenticateCameraApiKey,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { cam_key } = req.params;
      const { type, message, timestamp } = req.body;

      if (!type || !message) {
        res.status(400).json({ error: "type et message sont requis." });
        return;
      }

      // Vérifier que la caméra existe, sinon la créer automatiquement
      let camera = await pool.query(
        "SELECT * FROM cameras WHERE cam_key = $1",
        [cam_key]
      );

      if (camera.rows.length === 0) {
        // Créer automatiquement la caméra si elle n'existe pas
        camera = await pool.query(
          "INSERT INTO cameras (name, cam_key) VALUES ($1, $2) RETURNING *",
          [`Auto-created camera ${cam_key}`, cam_key]
        );
        console.log(`[INFO] Caméra auto-créée: ${cam_key}`);
      }

      // Convertir le timestamp Unix en Date si fourni
      let createdAt: Date;
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
        cameraName: camera.rows[0].name,
        createdAt: result.rows[0].created_at,
      });

      res.status(201).json({
        message: "Notification enregistrée et envoyée en temps réel",
        notification: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Erreur lors de l'enregistrement de la notification:",
        error
      );
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// Récupérer les caméras de l'utilisateur
router.get(
  "/my-cameras",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      const result = await pool.query(
        `SELECT c.id, c.name, c.cam_key FROM cameras c
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
  }
);

// Supprimer une caméra de l'utilisateur
router.delete(
  "/:id",
  authenticateToken,
  authenticateApiKey,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const cameraId = parseInt(req.params.id);
      const userId = req.user!.id;

      if (isNaN(cameraId)) {
        res.status(400).json({ error: "ID de caméra invalide." });
        return;
      }

      // Vérifier que la caméra existe et appartient à l'utilisateur
      const userCamera = await pool.query(
        `SELECT c.id, c.name, c.cam_key FROM cameras c
         JOIN user_cameras uc ON c.id = uc.camera_id
         WHERE c.id = $1 AND uc.user_id = $2`,
        [cameraId, userId]
      );

      if (userCamera.rows.length === 0) {
        res.status(404).json({
          error:
            "Caméra non trouvée ou vous n'avez pas les droits pour la supprimer.",
        });
        return;
      }

      // Supprimer la relation user_cameras
      await pool.query(
        "DELETE FROM user_cameras WHERE camera_id = $1 AND user_id = $2",
        [cameraId, userId]
      );

      // Vérifier s'il reste d'autres utilisateurs associés à cette caméra
      const remainingUsers = await pool.query(
        "SELECT * FROM user_cameras WHERE camera_id = $1",
        [cameraId]
      );

      // Si plus aucun utilisateur n'est associé, supprimer la caméra et ses notifications
      if (remainingUsers.rows.length === 0) {
        await pool.query("DELETE FROM notifications WHERE camera_id = $1", [
          cameraId,
        ]);
        await pool.query("DELETE FROM cameras WHERE id = $1", [cameraId]);
      }

      res.json({
        message: "Caméra supprimée avec succès",
        camera: userCamera.rows[0],
      });
    } catch (error) {
      console.error("Erreur lors de la suppression de la caméra:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

export default router;
