const express = require("express");
const router = express.Router();

const {
  getRentGenerationLogs,
} = require("../controllers/rentGenerationLogController");
const { verifyJWT } = require("../middleware/verifyJWT");

router.get(
  "/rent-generation-logs",verifyJWT,
  getRentGenerationLogs
);

module.exports = router;