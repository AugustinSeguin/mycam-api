const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const pool = require("./database");

let io = null;

// Map pour stocker les connexions utilisateur -> socket
const userSockets = new Map();

/**
 * Initialise Socket.IO avec le serveur HTTP
 * @param {http.Server} server - Serveur HTTP
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Middleware d'authentification Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Token manquant"));
      }

      // Vérifier le JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;

      next();
    } catch (error) {
      next(new Error("Token invalide"));
    }
  });

  io.on("connection", async (socket) => {
    console.log(
      `[Socket.IO] Utilisateur connecté: ${socket.userEmail} (ID: ${socket.userId})`
    );

    // Stocker la connexion
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
    }
    userSockets.get(socket.userId).add(socket.id);

    // Récupérer les caméras de l'utilisateur et rejoindre les rooms
    try {
      const result = await pool.query(
        `SELECT c.cam_key FROM cameras c
         JOIN user_cameras uc ON c.id = uc.camera_id
         WHERE uc.user_id = $1`,
        [socket.userId]
      );

      // Rejoindre une room pour chaque caméra
      result.rows.forEach((cam) => {
        socket.join(`camera:${cam.cam_key}`);
        console.log(
          `[Socket.IO] ${socket.userEmail} a rejoint la room camera:${cam.cam_key}`
        );
      });
    } catch (error) {
      console.error(
        "[Socket.IO] Erreur lors de la récupération des caméras:",
        error
      );
    }

    // Permettre à l'utilisateur de s'abonner manuellement à une caméra
    socket.on("subscribe:camera", (camKey) => {
      socket.join(`camera:${camKey}`);
      console.log(
        `[Socket.IO] ${socket.userEmail} s'est abonné à camera:${camKey}`
      );
    });

    // Permettre de se désabonner
    socket.on("unsubscribe:camera", (camKey) => {
      socket.leave(`camera:${camKey}`);
      console.log(
        `[Socket.IO] ${socket.userEmail} s'est désabonné de camera:${camKey}`
      );
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Utilisateur déconnecté: ${socket.userEmail}`);

      // Supprimer la connexion
      if (userSockets.has(socket.userId)) {
        userSockets.get(socket.userId).delete(socket.id);
        if (userSockets.get(socket.userId).size === 0) {
          userSockets.delete(socket.userId);
        }
      }
    });
  });

  console.log("[Socket.IO] Initialisé avec succès");
  return io;
};

/**
 * Émet une notification à tous les utilisateurs abonnés à une caméra
 * @param {string} camKey - Clé de la caméra
 * @param {object} notification - Données de la notification
 */
const emitNotification = (camKey, notification) => {
  if (!io) {
    console.error("[Socket.IO] Socket.IO non initialisé");
    return;
  }

  io.to(`camera:${camKey}`).emit("notification", {
    camKey,
    ...notification,
    receivedAt: new Date().toISOString(),
  });

  console.log(`[Socket.IO] Notification envoyée à camera:${camKey}`);
};

/**
 * Retourne l'instance Socket.IO
 */
const getIO = () => io;

module.exports = {
  initSocket,
  emitNotification,
  getIO,
};
