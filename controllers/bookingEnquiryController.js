
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

    const bookingEnquiry = await BookingEnquiry.create({
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
    const {
      page = 1,
      limit = 10,
      search = "",
    } = req.query;

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.max(Number(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    const query = {};

    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");

      query.$or = [
        { fullName: regex },
        { mobile: regex },
        { email: regex },
        { property: regex },
        { message: regex },
      ];
    }

    const [enquiries, total] = await Promise.all([
      BookingEnquiry.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      BookingEnquiry.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: enquiries,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
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