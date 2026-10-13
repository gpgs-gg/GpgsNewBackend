const express = require("express");

const {
  createBookingEnquiry,
  getBookingEnquiries,
  getBookingEnquiryById,
  updateBookingEnquiryStatus,
} = require("../controllers/bookingEnquiryController");

const rateLimit = require("express-rate-limit");
const {verifyJWT} = require("../middleware/verifyJWT");

const router = express.Router();

const bookingEnquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // One IP can submit max 5 enquiries
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public booking form
router.post("/",  bookingEnquiryLimiter, createBookingEnquiry);

// Admin APIs - Login required
router.get("/",verifyJWT, getBookingEnquiries);

router.get("/:id", verifyJWT, getBookingEnquiryById);

router.patch(
  "/:id/status",
  verifyJWT,
  updateBookingEnquiryStatus
);

module.exports = router;