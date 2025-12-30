# 📷 MyCam API

API REST pour la gestion de caméras de surveillance ESP32-CAM en temps réel avec système de notifications.

## 📋 Fonctionnalités

- 🔐 **Authentification** : Inscription et connexion avec JWT + validation de mot de passe fort
- 📹 **Gestion des caméras** : Création et gestion de caméras ESP32-CAM
- 🔔 **Notifications** : Réception et stockage des notifications (détection de mouvement, etc.)
- 🎥 **Flux vidéo** : Endpoint pour le streaming vidéo en temps réel
- 🔑 **Sécurité** : Protection par API Key et JWT Token

## 🛠️ Technologies

- **Node.js** + **Express** - Framework backend
- **Socket.IO** - Notifications en temps réel via WebSocket
- **PostgreSQL** - Base de données relationnelle
- **JWT** (jsonwebtoken) - Authentification par token
- **bcryptjs** - Hashage des mots de passe
- **dotenv** - Gestion des variables d'environnement

## 📦 Installation

### Prérequis

- Node.js >= 18.x
- PostgreSQL >= 14.x

### Étapes

1. **Cloner le repository**

```bash
git clone <repo-url>
cd mycam-api
```

2. **Installer les dépendances**

```bash
npm install
```

3. **Configurer les variables d'environnement**

Créer un fichier `.env` à la racine :

```env
# Serveur
PORT=3000
HOST=0.0.0.0

# Base de données PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mycam
DB_USER=postgres
DB_PASSWORD=your_password

# Sécurité
JWT_SECRET=your_super_secret_jwt_key
API_KEY=MyCamAPI_your_api_key_here
CAMERA_API_KEY=CamRegister_your_camera_api_key_here
```

4. **Initialiser la base de données**

```bash
npm run db:init
```

5. **Démarrer le serveur**

```bash
# Production
npm start

# Développement (avec hot reload)
npm run dev
```

## 📚 API Endpoints

### 🔓 Routes publiques

| Méthode | Endpoint  | Description                 |
| ------- | --------- | --------------------------- |
| `GET`   | `/health` | Vérifier le statut de l'API |

### 🔒 Routes d'authentification (API Key requise)

| Méthode | Endpoint         | Description                 | Auth                     |
| ------- | ---------------- | --------------------------- | ------------------------ |
| `POST`  | `/auth/register` | Créer un nouvel utilisateur | API Key + Camera API Key |
| `POST`  | `/auth/login`    | Authentifier un utilisateur | API Key                  |

### 🔒 Routes protégées (API Key requise)

| Méthode  | Endpoint                         | Description               | Auth          |
| -------- | -------------------------------- | ------------------------- | ------------- |
| `POST`   | `/cameras/create`                | Créer une nouvelle caméra | JWT + API Key |
| `GET`    | `/cameras/my-cameras`            | Récupérer ses caméras     | JWT + API Key |
| `DELETE` | `/cameras/:id`                   | Supprimer une caméra      | JWT + API Key |
| `GET`    | `/cameras/video/:cam_key`        | Flux vidéo en temps réel  | API Key       |
| `POST`   | `/cameras/notification/:cam_key` | Envoyer une notification  | API Key       |

## 📝 Exemples d'utilisation

### Inscription

```http
POST /auth/register
Content-Type: application/json
X-API-Key: <api_key>
X-Camera-API-Key: <camera_api_key>

{
  "nom": "Dupont",
  "prenom": "Jean",
  "email": "jean@example.com",
  "password": "Password123"
}
```

> ⚠️ Le mot de passe doit contenir minimum 8 caractères avec chiffres, minuscules et majuscules.
> 🔑 Cette route nécessite les headers `X-API-Key` et `X-Camera-API-Key`.

### Connexion

```http
POST /auth/login
Content-Type: application/json
X-API-Key: <api_key>

{
  "email": "jean@example.com",
  "password": "Password123"
}
```

**Réponse :**

```json
{
  "message": "Connexion réussie",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "nom": "Dupont",
    "prenom": "Jean",
    "email": "jean@example.com"
  }
}
```

### Créer une caméra

```http
POST /cameras/create
Content-Type: application/json
Authorization: Bearer <token>
X-API-Key: <api_key>

{
  "nom": "Caméra Salon",
  "cam_key": "cam_esp32_001"
}
```

### Envoyer une notification (ESP32-CAM)

```http
POST /cameras/notification/cam_esp32_001
Content-Type: application/json
X-API-Key: <api_key>

{
  "type": "motion",
  "message": "Mouvement détecté",
  "timestamp": 1702469789
}
```

> 💡 Si la caméra n'existe pas, elle sera créée automatiquement.

## � Notifications en temps réel (WebSocket)

L'API utilise **Socket.IO** pour envoyer des notifications en temps réel aux utilisateurs connectés.

### Connexion au WebSocket

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  auth: {
    token: "votre_jwt_token", // Token obtenu via /auth/login
  },
});

// Connexion réussie
socket.on("connect", () => {
  console.log("Connecté au serveur WebSocket");
});

// Recevoir les notifications
socket.on("notification", (data) => {
  console.log("Nouvelle notification:", data);
  // {
  //   camKey: "cam_esp32_001",
  //   id: 1,
  //   type: "motion",
  //   message: "Mouvement détecté",
  //   cameraName: "Caméra Salon",
  //   createdAt: "2024-12-13T10:30:00.000Z",
  //   receivedAt: "2024-12-13T10:30:00.123Z"
  // }
});

// Erreur de connexion
socket.on("connect_error", (error) => {
  console.error("Erreur de connexion:", error.message);
});
```

### Événements disponibles

| Événement            | Direction        | Description                              |
| -------------------- | ---------------- | ---------------------------------------- |
| `notification`       | Serveur → Client | Nouvelle notification reçue              |
| `subscribe:camera`   | Client → Serveur | S'abonner aux notifications d'une caméra |
| `unsubscribe:camera` | Client → Serveur | Se désabonner d'une caméra               |

### S'abonner/Désabonner manuellement

```javascript
// S'abonner à une caméra spécifique
socket.emit("subscribe:camera", "cam_esp32_002");

// Se désabonner
socket.emit("unsubscribe:camera", "cam_esp32_002");
```

> 📌 À la connexion, l'utilisateur est automatiquement abonné à toutes ses caméras (via la table `user_cameras`).

## �🗄️ Structure de la base de données

```sql
-- Table des utilisateurs
users (id, nom, prenom, email, password, api_key, created_at)

-- Table des caméras
cameras (id, nom, cam_key, created_by, created_at)

-- Table de relation utilisateur-caméra (many-to-many)
user_cameras (user_id, camera_id)

-- Table des notifications
notifications (id, camera_id, type, message, created_at)
```

## 📁 Structure du projet

```
mycam-api/
├── src/
│   ├── index.js              # Point d'entrée
│   ├── config/
│   │   ├── database.js       # Configuration PostgreSQL
│   │   └── socket.js         # Configuration Socket.IO
│   ├── middleware/
│   │   └── auth.js           # Middlewares JWT & API Key
│   ├── routes/
│   │   ├── auth.js           # Routes d'authentification
│   │   └── cameras.js        # Routes des caméras
│   └── scripts/
│       └── initDb.js         # Script d'initialisation DB
├── http/
│   └── routes.http           # Fichier de test des routes
├── .env                      # Variables d'environnement
├── package.json
└── README.md
```

## 🧪 Tester l'API

Un fichier `http/routes.http` est fourni pour tester les routes avec l'extension [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) de VS Code.

## 📄 Licence

MIT
