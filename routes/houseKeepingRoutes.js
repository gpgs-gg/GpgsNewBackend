const express = require("express");
const router = express.Router();

const {
  fetchHousekeepingData,
  updateHousekeepingData,
} = require("../controllers/HouseKeepingController");
const {verifyJWT} = require("../middleware/verifyJWT");

// Fetch housekeeping dashboard data
router.get("/", verifyJWT,fetchHousekeepingData);

// Update housekeeping records
router.post("/update",verifyJWT, updateHousekeepingData);

module.exports = router;