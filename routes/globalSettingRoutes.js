const express = require("express");
const router = express.Router();

const {
  getLeadAutoTransfer,
  updateLeadAutoTransfer,
} = require("../controllers/GlobalSettingController");

router.get("/lead-auto-transfer", getLeadAutoTransfer);

router.put("/lead-auto-transfer", updateLeadAutoTransfer);

module.exports = router;