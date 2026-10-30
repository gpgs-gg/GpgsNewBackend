const express = require("express");
const router = express.Router();

const controller = require(
  "../controllers/propertyExpenseController"
);

// IMPORTANT:
// Import your existing JWT/authentication middleware here.
// Example only:
const { verifyJWT } = require("../middleware/verifyJWT");
//
// Apply verifyJWT to ALL routes before deploying.
// Also apply your GPGS canAdd/canEdit/canDelete permission
// middleware to POST/PUT/DELETE.

router.get("/summary", controller.getExpenseSummary);
router.get("/",verifyJWT, controller.getExpenses);
router.post("/", verifyJWT, controller.createExpense);
router.put("/:id",verifyJWT ,controller.updateExpense);
router.delete("/:id", controller.deleteExpense);
router.get("/propertyExpense/:propertyId",verifyJWT,controller.getExpensesByPropertyId);

module.exports = router;