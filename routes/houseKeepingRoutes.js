const express = require("express");
const router = express.Router();

const {
  fetchHousekeepingData,
  updateHousekeepingData,
} = require("../controllers/HouseKeepingController");

// Fetch housekeeping dashboard data
router.get("/", fetchHousekeepingData);

// Update housekeeping records
router.post("/update", updateHousekeepingData);

module.exports = router;