const express = require("express");
const router = express.Router();

const {
  transferBed,
} = require("../controllers/BedTransferController");
const {verifyJWT} = require("../middleware/verifyJWT");
// Transfer Bed
router.post("/transfer-bed", verifyJWT, transferBed);

module.exports = router;