const express = require("express");
const router = express.Router();

const {
  fetchMaintenanceData,
  updateMaintenanceData,
} = require("../controllers/MaintenanceController");

// Fetch maintenance dashboard data
router.get("/", fetchMaintenanceData);

// Update maintenance records
router.post("/update", updateMaintenanceData);

module.exports = router;