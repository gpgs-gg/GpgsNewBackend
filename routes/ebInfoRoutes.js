const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const {
  getElectricityBillData,
  updateElectricityBillData,
  creaetElectricityBillData,
  getSingleElectricityBillData
} = require("../controllers/ebInfoController");

router.post( "/",upload.array("attachment", 5),creaetElectricityBillData);
router.get("/", getElectricityBillData);
router.get("/:id",getSingleElectricityBillData);
router.put( "/:id",upload.array("attachment", 5),updateElectricityBillData );

module.exports = router;