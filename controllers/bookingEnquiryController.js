
// =====================================================
// CREATE BOOKING ENQUIRY
// =====================================================

const BookingEnquiry = require("../models/BookingEnquiry.model");

exports.createBookingEnquiry = async (req, res) => {
  try {
    const {
      fullName,
      whatsappNumber,
      callingNumber,
      email,
      companyCollegeName,
      profile,
      joiningDate,
      fatherName,
      fatherContact,
      motherName,
      motherContact,
    } = req.body;

    // ==============================
    // REQUIRED VALIDATION
    // ==============================

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Client Name is required",
      });
    }

    if (!whatsappNumber || !whatsappNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp Contact No. is required",
      });
    }

    if (!joiningDate) {
      return res.status(400).json({
        success: false,
        message: "Date of Joining at PG is required",
      });
    }

    // ==============================
    // CREATE
    // ==============================

    const bookingEnquiry = await BookingEnquiryModel.create({
      fullName: fullName.trim(),
      whatsappNumber: whatsappNumber.trim(),
      callingNumber: callingNumber?.trim() || "",
      email: email?.trim().toLowerCase() || "",
      companyCollegeName: companyCollegeName?.trim() || "",
      profile: profile?.trim() || "",
      joiningDate,
      fatherName: fatherName?.trim() || "",
      fatherContact: fatherContact?.trim() || "",
      motherName: motherName?.trim() || "",
      motherContact: motherContact?.trim() || "",
      status: "Pending",
    });

    return res.status(201).json({
      success: true,
      message:
        "Booking enquiry submitted successfully. Our team will contact you shortly.",
      data: bookingEnquiry,
    });
  } catch (error) {
    console.error("CREATE BOOKING ENQUIRY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while submitting booking enquiry",
      error: error.message,
    });
  }
};

// =====================================================
// GET ALL BOOKING ENQUIRIES
// =====================================================

exports.getBookingEnquiries = async (req, res) => {
  try {
    const enquiries = await BookingEnquiry.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: enquiries,
    });
  } catch (error) {
    console.error("GET BOOKING ENQUIRIES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking enquiries",
      error: error.message,
    });
  }
};

// =====================================================
// GET SINGLE BOOKING ENQUIRY
// =====================================================

exports.getBookingEnquiryById = async (req, res) => {
  try {
    const { id } = req.params;

    const enquiry = await BookingEnquiry.findById(id).lean();

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Booking enquiry not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    console.error("GET BOOKING ENQUIRY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking enquiry",
      error: error.message,
    });
  }
};

// =====================================================
// UPDATE BOOKING ENQUIRY STATUS
// =====================================================

exports.updateBookingEnquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const allowedStatuses = [
      "Pending",
      "Contacted",
      "Confirmed",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const enquiry = await BookingEnquiry.findByIdAndUpdate(
      id,
      {
        status,
        remarks: remarks || "",
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Booking enquiry not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking enquiry updated successfully",
      data: enquiry,
    });
  } catch (error) {
    console.error("UPDATE BOOKING ENQUIRY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update booking enquiry",
      error: error.message,
    });
  }
};