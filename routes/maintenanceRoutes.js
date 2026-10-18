const express = require("express");
const router = express.Router();

const {
  fetchMaintenanceData,
  updateMaintenanceData,
} = require("../controllers/MaintenanceController");
const {verifyJWT} = require("../middleware/verifyJWT");

// Fetch maintenance dashboard data
router.get("/",verifyJWT, fetchMaintenanceData);

// Update maintenance records
router.post("/update",verifyJWT, updateMaintenanceData);

module.exports = router;