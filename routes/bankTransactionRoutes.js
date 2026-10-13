// routes/bankTransactionRoutes.js
const express = require("express");
const router = express.Router();
const bankController = require("../controllers/bankTransactionController");
const { verifyJWT } = require("../middleware/verifyJWT");
// Routes
router.post("/upload", verifyJWT,  bankController.upload.single("file"), bankController.uploadBankStatement);
router.put("/transaction-received", verifyJWT,  bankController.updateClientRentHistoryReceived);
router.get("/", verifyJWT, bankController.getAllTransactions);
router.get(
  "/amountFromNarration/:narration",
  verifyJWT,
  bankController.getTransactionByNarration
); 
router.get("/:account/:id",verifyJWT, bankController.getTransactionById);

router.put("/:account/:id",verifyJWT, bankController.updateTransaction);
router.get("/summary/stats",verifyJWT, bankController.getSummary);
router.get("/clients/property/:propertyId",verifyJWT, bankController.getClientsByPropertyId);
router.post(
  "/generate-test-transactions",verifyJWT,
  bankController.generateTestTransactions
);

module.exports = router;