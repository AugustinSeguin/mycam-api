const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Fonction pour valider la force du mot de passe
const validatePassword = (password) => {
  const hasNumber = /\d/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const isLongEnough = password.length >= 8;

  return hasNumber && hasLower && hasUpper && isLongEnough;
};

// Register - Créer un nouvel utilisateur
router.post("/register", async (req, res) => {
  try {
    const { nom, prenom, email, password } = req.body;

    if (!nom || !prenom || !email || !password) {
      return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        error:
          "Le mot de passe doit contenir au minimum 8 caractères avec chiffres, lettres minuscules et majuscules.",
      });
    }

    // Vérifier si l'email existe déjà
    const emailExists = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (emailExists.rows.length > 0) {
      return res.status(400).json({ error: "Cet email est déjà utilisé." });
    }

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const result = await pool.query(
      "INSERT INTO users (nom, prenom, email, password) VALUES ($1, $2, $3, $4) RETURNING id, nom, prenom, email",
      [nom, prenom, email, hashedPassword]
    );

    res.status(201).json({
      message: "Utilisateur créé avec succès",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur lors de la création de l'utilisateur:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Login - Authentifier un utilisateur
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis." });
    }

    // Rechercher l'utilisateur
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ error: "Email ou mot de passe incorrect." });
    }

    const user = result.rows[0];

    // Vérifier le mot de passe
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res
        .status(401)
        .json({ error: "Email ou mot de passe incorrect." });
    }

    // Créer un JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Connexion réussie",
      token,
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la connexion:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
