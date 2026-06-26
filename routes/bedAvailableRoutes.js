const express = require("express");
const router = express.Router();

const {
  getAllAvailableBeds,
  getPropertyWiseAvailableBeds,
} = require("../controllers/BedAvailableController");

const {verifyJWT} = require("../middleware/verifyJWT");


router.get("/available-beds",verifyJWT, getAllAvailableBeds);

router.get(
  "/available-beds/:propertyId", verifyJWT,
  getPropertyWiseAvailableBeds
);

module.exports = router;