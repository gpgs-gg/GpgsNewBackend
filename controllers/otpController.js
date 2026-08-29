const nodemailer = require("nodemailer");
const User = require("../models/user.model");

/* =========================
   GENERATE OTP
========================= */
const generateOTP = (length = 6) => {
  const digits = "0123456789";
  let otp = "";

  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }

  return otp;
};

/* =========================
   NODEMAILER CONFIG
========================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
/* =========================
   OTP STORE
========================= */
// Example:
// otpStore[email] = {
//   otp: "123456",
//   expiresAt: Date
// }

const otpStore = {};

/* =========================
   SEND OTP
========================= */
const sendOtp = async (req, res) => {
  try {
    const email = req.body.email?.trim()?.toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    /* =========================
       CHECK USER IN MONGODB
    ========================= */
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Email not registered",
      });
    }

    /* =========================
       CHECK ACTIVE USER
    ========================= */
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    /* =========================
       GENERATE OTP
    ========================= */
    const otp = generateOTP();

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    otpStore[email] = {
      otp,
      expiresAt,
    };

    /* =========================
       SEND MAIL
    ========================= */
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP is ${otp}. Valid for 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("SEND OTP ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

/* =========================
   VERIFY OTP
========================= */
const verifyOtp = async (req, res) => {
  try {
    const email = req.body.email?.trim()?.toLowerCase();

    const otp = req.body.otp?.trim();

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const record = otpStore[email];

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "No OTP found for this email",
      });
    }

    const { otp: storedOtp, expiresAt } = record;

    /* =========================
       CHECK EXPIRY
    ========================= */
    if (new Date() > expiresAt) {
      delete otpStore[email];

      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    /* =========================
       VERIFY OTP
    ========================= */
    if (String(otp) !== String(storedOtp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    /* =========================
       SUCCESS
    ========================= */
    delete otpStore[email];

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("VERIFY OTP ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
};
module.exports = {
  sendOtp,
  verifyOtp,
};