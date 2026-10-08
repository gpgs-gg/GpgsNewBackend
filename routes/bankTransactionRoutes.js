// routes/bankTransactionRoutes.js
const express = require("express");
const router = express.Router();
const bankController = require("../controllers/bankTransactionController");

// Routes
router.post("/upload", bankController.upload.single("file"), bankController.uploadBankStatement);
router.put("/transaction-received", bankController.updateClientRentHistoryReceived);
router.get("/", bankController.getAllTransactions);
router.get(
  "/amountFromNarration/:narration",
  bankController.getTransactionByNarration
); 
router.get("/:account/:id", bankController.getTransactionById);

router.put("/:account/:id", bankController.updateTransaction);
router.get("/summary/stats", bankController.getSummary);
router.get("/clients/property/:propertyId", bankController.getClientsByPropertyId);
router.post(
  "/generate-test-transactions",
  bankController.generateTestTransactions
);

module.exports = router;