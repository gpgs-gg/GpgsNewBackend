const express = require("express");
const router = express.Router();

const {
  getRentGenerationLogs,
} = require("../controllers/rentGenerationLogController");

router.get(
  "/rent-generation-logs",
  getRentGenerationLogs
);

module.exports = router;