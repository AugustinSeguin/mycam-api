import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types";

// Middleware pour valider la cam_key
export const validateCamKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const camKey = req.headers["x-cam-key"] as string;

  if (!camKey) {
    res.status(401).json({ error: "cam_key manquante." });
    return;
  }

  // La validation de la cam_key avec la base de données sera faite dans les routes
  req.camKey = camKey;
  next();
};
