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
- création d'une camera (par cam_key & nom)

**Feature users & cam**

Il faut créer une table users & une table cameras.
un utilisateur peut avoir plusieurs cameras. et une camera plusieurs utilisateurs.
Un utilisateur : id, nom, prenom, email, password (minimum 8 chars donc chiffres, lettres, min & maj)
Une camera : id, nom, cam_key

**Feature secu**

utiliser une API key & une cam key (dela table camera)

