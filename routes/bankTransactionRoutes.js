// routes/bankTransactionRoutes.js
const express = require("express");
const router = express.Router();
const bankController = require("../controllers/bankTransactionController");

// Routes
router.post("/upload", bankController.upload.single("file"), bankController.uploadBankStatement);
router.put("/transaction-received", bankController.updateClientRentHistoryReceived);
router.get("/", bankController.getAllTransactions);
router.get("/:id", bankController.getTransactionById);
router.put("/:id", bankController.updateTransaction);
router.delete("/:id", bankController.deleteTransaction);
router.post("/delete-multiple", bankController.deleteMultipleTransactions);
router.get("/summary/stats", bankController.getSummary);
router.get("/clients/property/:propertyId", bankController.getClientsByPropertyId);


module.exports = router;