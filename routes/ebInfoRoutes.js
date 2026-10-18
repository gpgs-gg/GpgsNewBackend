const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const {
  getElectricityBillData,
  updateElectricityBillData,
  creaetElectricityBillData,
  getSingleElectricityBillData,bulkTransferElectricityBill
} = require("../controllers/ebInfoController");
const {verifyJWT} = require("../middleware/verifyJWT");

router.post( "/", verifyJWT ,upload.array("attachment", 5), creaetElectricityBillData);
router.get("/", verifyJWT, getElectricityBillData);
router.put("/bulk-transfer", verifyJWT,bulkTransferElectricityBill);
router.get("/:id",verifyJWT,getSingleElectricityBillData);
router.put( "/:id",verifyJWT, upload.array("attachment", 5),updateElectricityBillData );

module.exports = router;