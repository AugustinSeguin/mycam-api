import "dotenv/config";
import pool from "../config/database";

const initDb = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    console.log("Initialisation de la base de données...");

    // Créer la table users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        lastname VARCHAR(100) NOT NULL,
        firstname VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table users créée");

    // Créer la table cameras
    await client.query(`
      CREATE TABLE IF NOT EXISTS cameras (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        cam_key VARCHAR(255) UNIQUE NOT NULL,
        ip_address VARCHAR(255),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table cameras créée");

    // Créer la table de relation many-to-many
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_cameras (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        camera_id INTEGER NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, camera_id)
      );
    `);
    console.log("Table user_cameras créée");

    // Créer la table notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        camera_id INTEGER NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table notifications créée");

    console.log("Base de données initialisée avec succès!");
  } catch (error) {
    console.error(
      "Erreur lors de l'initialisation de la base de données:",
      error
    );
  } finally {
    client.release();
    await pool.end();
  }
};

initDb();
