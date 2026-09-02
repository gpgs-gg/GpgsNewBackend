const express = require("express");
const router = express.Router();
const {
  createElectricityReading,
  getElectricityReading,
  getPropertyElectricityReadings,
  updateElectricityReading,
  getElectricityReadingById,
  getPreviousElectricityReading,
  getLatestACConsumptionData
} = require("../controllers/acebReadingController");



// Create monthly reading
router.post(
  "/",
  createElectricityReading
);


// Get specific property + month
router.get(
  "/",
  getElectricityReading
);

router.get(
  "/previous",
  getPreviousElectricityReading
);
// Get all months of property
router.get(
  "/roomId/:roomId",
  getPropertyElectricityReadings
);

router.get(
  "/:id",
  getElectricityReadingById
);

// Update monthly reading
router.put(
  "/:id",
  updateElectricityReading
);

router.get(
  "/ac-consumption/:propertyId",
  getLatestACConsumptionData
);

module.exports = router;