import express, { Response } from "express";
import pool from "../config/database";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  authenticateApiKey,
  authenticateCameraApiKey,
} from "../middleware/auth";
import { AuthenticatedRequest } from "../types";

const router = express.Router();

// Fonction pour valider la force du mot de passe
const validatePassword = (password: string): boolean => {
  const hasNumber = /\d/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const isLongEnough = password.length >= 8;

  return hasNumber && hasLower && hasUpper && isLongEnough;
};

// Register - Créer un nouvel utilisateur
router.post(
  "/register",
  authenticateApiKey,
  authenticateCameraApiKey,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { lastname, firstname, email, password } = req.body;

      if (!lastname || !firstname || !email || !password) {
        res.status(400).json({ error: "Tous les champs sont requis." });
        return;
      }

      if (!validatePassword(password)) {
        res.status(400).json({
          error:
            "Le mot de passe doit contenir au minimum 8 caractères avec chiffres, lettres minuscules et majuscules.",
        });
        return;
      }

      // Vérifier si l'email existe déjà
      const emailExists = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );

      if (emailExists.rows.length > 0) {
        res.status(400).json({ error: "Cet email est déjà utilisé." });
        return;
      }

      // Hash du mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);

      // Créer l'utilisateur
      const result = await pool.query(
        "INSERT INTO users (lastname, firstname, email, password) VALUES ($1, $2, $3, $4) RETURNING id, lastname, firstname, email",
        [lastname, firstname, email, hashedPassword]
      );

      res.status(201).json({
        message: "Utilisateur créé avec succès",
        user: result.rows[0],
      });
    } catch (error) {
      console.error("Erreur lors de la création de l'utilisateur:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// Login - Authentifier un utilisateur
router.post(
  "/login",
  authenticateApiKey,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email et mot de passe requis." });
        return;
      }

      // Rechercher l'utilisateur
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);

      if (result.rows.length === 0) {
        res.status(401).json({ error: "Email ou mot de passe incorrect." });
        return;
      }

      const user = result.rows[0];

      // Vérifier le mot de passe
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        res.status(401).json({ error: "Email ou mot de passe incorrect." });
        return;
      }

      // Créer un JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET as string,
        {
          expiresIn: "24h",
        }
      );

      res.json({
        message: "Connexion réussie",
        token,
        user: {
          id: user.id,
          lastname: user.lastname,
          firstname: user.firstname,
          email: user.email,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la connexion:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

export default router;
