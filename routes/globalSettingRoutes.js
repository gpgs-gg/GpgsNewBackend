const express = require("express");
const router = express.Router();

const {
  getGlobalSettings,
  updateGlobalSettings,
} = require("../controllers/GlobalSettingController");

router.get("/global-settings", getGlobalSettings);
router.put("/global-settings", updateGlobalSettings);

module.exports = router;