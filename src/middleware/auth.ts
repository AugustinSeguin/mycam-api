import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest, UserPayload } from "../types";

// Middleware pour vérifier le JWT token
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: "Accès refusé. Token manquant." });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
    if (err) {
      res.status(403).json({ error: "Token invalide ou expiré." });
      return;
    }
    req.user = decoded as UserPayload;
    next();
  });
};

// Middleware pour vérifier l'API Key
export const authenticateApiKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey || apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: "API Key invalide." });
    return;
  }

  next();
};

// Middleware pour vérifier la Camera API Key (pour l'enregistrement)
export const authenticateCameraApiKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const cameraApiKey = req.headers["x-camera-api-key"] as string;

  if (!cameraApiKey || cameraApiKey !== process.env.CAMERA_API_KEY) {
    res.status(401).json({ error: "Camera API Key invalide." });
    return;
  }

  next();
};
