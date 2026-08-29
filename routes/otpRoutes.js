const express = require("express");

const { sendOtp, verifyOtp } = require("../controllers/otpController.js");
const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
module.exports = router;