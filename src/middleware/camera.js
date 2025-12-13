// Middleware pour valider la cam_key
const validateCamKey = async (req, res, next) => {
  const camKey = req.headers["x-cam-key"];

  if (!camKey) {
    return res.status(401).json({ error: "cam_key manquante." });
  }

  // La validation de la cam_key avec la base de données sera faite dans les routes
  req.camKey = camKey;
  next();
};

module.exports = {
  validateCamKey,
};
