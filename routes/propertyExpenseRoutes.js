const express = require("express");
const router = express.Router();

const controller = require(
  "../controllers/propertyExpenseController"
);

// IMPORTANT:
// Import your existing JWT/authentication middleware here.
// Example only:
// const { verifyJWT } = require("../middleware/auth.middleware");
//
// Apply verifyJWT to ALL routes before deploying.
// Also apply your GPGS canAdd/canEdit/canDelete permission
// middleware to POST/PUT/DELETE.

router.get("/summary", controller.getExpenseSummary);
router.get("/", controller.getExpenses);
router.post("/", controller.createExpense);
router.put("/:id", controller.updateExpense);
router.delete("/:id", controller.deleteExpense);
router.get("/propertyExpense/:propertyId", controller.getExpensesByPropertyId);

module.exports = router;