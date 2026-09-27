const express = require("express");

const {
  createBookingEnquiry,
  getBookingEnquiries,
  getBookingEnquiryById,
  updateBookingEnquiryStatus,
} = require("../controllers/bookingEnquiryController");

const router = express.Router();

// Public booking form
router.post("/", createBookingEnquiry);

// Admin
router.get("/", getBookingEnquiries);

router.get("/:id", getBookingEnquiryById);

router.patch("/:id/status", updateBookingEnquiryStatus);

module.exports = router;