const express = require("express");
const router = express.Router();

const {
  getPropertyEbCalculationData,
} = require("../controllers/ebCalculatorController");

router.get(
  "/property-eb-calculation",
  getPropertyEbCalculationData
);

module.exports = router;