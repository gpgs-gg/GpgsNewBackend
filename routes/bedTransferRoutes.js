const express = require("express");
const router = express.Router();

const {
  transferBed,
} = require("../controllers/BedTransferController");

// Transfer Bed
router.post("/transfer-bed", transferBed);

module.exports = router;