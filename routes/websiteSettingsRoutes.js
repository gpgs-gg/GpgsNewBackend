const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");

const {
  getHeroVideo,
  updateHeroVideo,
} = require("../controllers/websiteSettingsController");

const { verifyJWT } = require("../middleware/verifyJWT");

// ========================================
// PUBLIC API - GET HERO VIDEO
// ========================================

router.get("/hero-video", getHeroVideo);

// ========================================
// ADMIN API - UPLOAD / REPLACE HERO VIDEO
// ========================================

router.put("/hero-video", verifyJWT, upload.single("video"), updateHeroVideo);

module.exports = router;