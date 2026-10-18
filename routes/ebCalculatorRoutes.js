const express = require("express");
const router = express.Router();

const {
  getPropertyEbClients ,
} = require("../controllers/ebCalculatorController");
const {verifyJWT} = require("../middleware/verifyJWT");

router.get(
  "/eb-calculator/property/:propertyId",verifyJWT,
  getPropertyEbClients 
);

module.exports = router;