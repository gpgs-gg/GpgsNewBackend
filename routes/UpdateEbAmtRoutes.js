const express = require("express");
const router = express.Router();

const {
    updateEBAmountInRentHistory,
      createEBCalculation,
      getAllEBCalculations,
      getEBCalculationById
} = require("../controllers/UpdateEbAmtController");
const { verifyJWT } = require("../middleware/verifyJWT");

router.post(
    "/create-eb-calculation",verifyJWT,
    createEBCalculation
);
// Update EB Amount in Client Rent History
router.put(
    "/update-eb-rent-history",verifyJWT,
    updateEBAmountInRentHistory
);

router.get("/eb-calculation-details",verifyJWT, getAllEBCalculations);
router.get("/eb-calculation-details/:id",verifyJWT, getEBCalculationById);

module.exports = router;