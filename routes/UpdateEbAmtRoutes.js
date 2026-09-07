const express = require("express");
const router = express.Router();

const {
    updateEBAmountInRentHistory,
      createEBCalculation,
      getAllEBCalculations,
      getEBCalculationById
} = require("../controllers/UpdateEbAmtController");

router.post(
    "/create-eb-calculation",
    createEBCalculation
);
// Update EB Amount in Client Rent History
router.put(
    "/update-eb-rent-history",
    updateEBAmountInRentHistory
);

router.get("/eb-calculation-details", getAllEBCalculations);
router.get("/eb-calculation-details/:id", getEBCalculationById);

module.exports = router;