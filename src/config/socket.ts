import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import http from "http";
import pool from "./database";
import { UserPayload, NotificationPayload } from "../types";

let io: Server | null = null;

// Map pour stocker les connexions utilisateur -> socket
const userSockets = new Map<number, Set<string>>();

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userEmail?: string;
}

/**
 * Initialise Socket.IO avec le serveur HTTP
 */
export const initSocket = (server: http.Server): Server => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Middleware d'authentification Socket.IO
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token as string;

      if (!token) {
        return next(new Error("Token manquant"));
      }

      // Vérifier le JWT
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as UserPayload;
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;

      next();
    } catch {
      next(new Error("Token invalide"));
    }
  });

  io.on("connection", async (socket: AuthenticatedSocket) => {
    console.log(
      `[Socket.IO] Utilisateur connecté: ${socket.userEmail} (ID: ${socket.userId})`
    );

    // Stocker la connexion
    if (socket.userId) {
      if (!userSockets.has(socket.userId)) {
        userSockets.set(socket.userId, new Set());
      }
      userSockets.get(socket.userId)!.add(socket.id);
    }

    // Récupérer les caméras de l'utilisateur et rejoindre les rooms
    try {
      const result = await pool.query(
        `SELECT c.cam_key FROM cameras c
         JOIN user_cameras uc ON c.id = uc.camera_id
         WHERE uc.user_id = $1`,
        [socket.userId]
      );

      // Rejoindre une room pour chaque caméra
      result.rows.forEach((cam: { cam_key: string }) => {
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
    socket.on("subscribe:camera", (camKey: string) => {
      socket.join(`camera:${camKey}`);
      console.log(
        `[Socket.IO] ${socket.userEmail} s'est abonné à camera:${camKey}`
      );
    });

    // Permettre de se désabonner
    socket.on("unsubscribe:camera", (camKey: string) => {
      socket.leave(`camera:${camKey}`);
      console.log(
        `[Socket.IO] ${socket.userEmail} s'est désabonné de camera:${camKey}`
      );
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Utilisateur déconnecté: ${socket.userEmail}`);

      // Supprimer la connexion
      if (socket.userId && userSockets.has(socket.userId)) {
        userSockets.get(socket.userId)!.delete(socket.id);
        if (userSockets.get(socket.userId)!.size === 0) {
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
 */
export const emitNotification = (
  camKey: string,
  notification: Omit<NotificationPayload, "camKey" | "receivedAt">
): void => {
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
export const getIO = (): Server | null => io;
