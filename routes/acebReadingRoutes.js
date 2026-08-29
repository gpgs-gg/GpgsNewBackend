const express = require("express");
const router = express.Router();
const {
  createElectricityReading,
  getElectricityReading,
  getPropertyElectricityReadings,
  updateElectricityReading,
  getElectricityReadingById,
  getPreviousElectricityReading

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
  "/property/:propertyId",
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


module.exports = router;