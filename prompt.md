# API caméra

API caméra surveillance en temps réel + notif.
Langage: nodeJS

**init project**

packages nodeJS pour :

- gestion .env
- api
- bdd (postgresql)

**Feature api**

Il me faut un serveur avec 3 routes :

- vidéo en temps réel
- notification (route post)
- login (email mdp)
- register (création d'un nouveau user)
- création d'une camera (par cam_key & lastname)

**Feature users & cam**

Il faut créer une table users & une table cameras.
un utilisateur peut avoir plusieurs cameras. et une camera plusieurs utilisateurs.
Un utilisateur : id, lastname, firstname, email, password (minimum 8 chars donc chiffres, lettres, min & maj)
Une camera : id, lastname, cam_key

**Feature secu**

utiliser une API key & une cam key (de la table camera)

**Feature notif**

Lorsque cette route la est appelée :

```json
POST {{baseUrl}}/cameras/notification/{{camKey}}
Content-Type: application/json
X-API-Key: {{apiKey}}

{
  "type": "motion",
  "message": "Movement detected by ESP32-CAM",
  "timestamp": 1702469789
}
```

je veux que tu envoie en temps reel une notification a l'utilisateur connecté.
Utilise les packages adaptés.
