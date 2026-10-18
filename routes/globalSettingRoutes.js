const express = require("express");
const router = express.Router();

const {
  getGlobalSettings,
  updateGlobalSettings,
} = require("../controllers/GlobalSettingController");
const {verifyJWT} = require("../middleware/verifyJWT");

router.get("/global-settings",verifyJWT, getGlobalSettings);
router.put("/global-settings",verifyJWT, updateGlobalSettings);

module.exports = router;