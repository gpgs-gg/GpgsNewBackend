const express = require("express");
const router = express.Router();

const {
  getPropertyEbClients ,
} = require("../controllers/ebCalculatorController");

router.get(
  "/eb-calculator/property/:propertyId",
  getPropertyEbClients 
);

module.exports = router;