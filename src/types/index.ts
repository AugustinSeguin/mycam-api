import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";

export interface UserPayload extends JwtPayload {
  id: number;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
  camKey?: string;
}

export interface Camera {
  id: number;
  lastname: string;
  cam_key: string;
  created_by?: number;
  created_at?: Date;
}

export interface User {
  id: number;
  lastname: string;
  firstname: string;
  email: string;
  password: string;
  created_at?: Date;
}

export interface Notification {
  id: number;
  camera_id: number;
  type: string;
  message: string;
  created_at: Date;
}

export interface NotificationPayload {
  id: number;
  type: string;
  message: string;
  cameraName: string;
  createdAt: Date;
  camKey?: string;
  receivedAt?: string;
}
