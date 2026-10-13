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

const { verifyJWT } = require("../middleware/verifyJWT");


// Create monthly reading
router.post(
  "/",
  verifyJWT,
  createElectricityReading
);


// Get specific property + month
router.get(
  "/",
  verifyJWT,
  getElectricityReading
);

router.get(
  "/previous",
  verifyJWT,
  getPreviousElectricityReading
);
// Get all months of property
router.get(
  "/roomId/:roomId",
  verifyJWT,
  getPropertyElectricityReadings
);

router.get(
  "/:id",
  verifyJWT,
  getElectricityReadingById
);

// Update monthly reading
router.put(
  "/:id",
  verifyJWT,
  updateElectricityReading
);

router.get(
  "/ac-consumption/:propertyId",
  verifyJWT,
  getLatestACConsumptionData
);

module.exports = router;