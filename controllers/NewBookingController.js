const Booking = require("../models/newBooking.model");
const Client = require("../models/client.model");
const User = require("../models/user.model");
const Property = require("../models/property.model")
// CREATE BOOKING
exports.createBooking = async (req, res) => {
  try {
    const booking = await Booking.create(req.body);

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Create Booking Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET ALL BOOKINGS
exports.getAllBookings = async (req, res) => {
  try {
    const {
      // Text/Select filters
      fullName,
      callingNo,
      whatsappNo,
      status,
      bookingType,

      // Property related
      propertyId,
      propertyLocation,
      roomNo,
      bedNo,

      // Temporary property related
      temporaryPropertyId,
      temporaryBedNo,

      // Date filters
      clientDojFrom,
      clientDojTo,
      temporaryClientDojFrom,
      temporaryClientDojTo,

      // Amount filters
      monthlyRentMin,
      monthlyRentMax,
      depositAmountMin,
      depositAmountMax,
      processingFeesMin,
      processingFeesMax,
      totalAmountMin,
      totalAmountMax,
      bookingAmountMin,
      bookingAmountMax,
      balanceAmountMin,
      balanceAmountMax,

      // Pagination
      page = 1,
      limit = 10,
      search = "",
    } = req.query;

    // Build filter object
    let filter = {};
    if (propertyLocation) {
      const properties = await Property.find({
        propertyLocation: propertyLocation,
      }).select("_id propertyLocation");
      filter.propertyId = {
        $in: properties.map((p) => p._id),
      }
    }
    // Text filters (case-insensitive regex)
    if (fullName) {
      filter.fullName = { $regex: fullName, $options: "i" };
    }
    if (callingNo) {
      filter.callingNo = { $regex: callingNo, $options: "i" };
    }
    if (whatsappNo) {
      filter.whatsappNo = { $regex: whatsappNo, $options: "i" };
    }
    if (status) {
      filter.status = status;
    }
    if (bookingType === "Permanent") {
      filter.propertyId = { $ne: null };
    }

    if (bookingType === "Temporary") {
      filter.temporaryPropertyId = { $ne: null };
    }

    // Property filters
    if (propertyId) {
      filter.propertyId = propertyId;
    }

    if (roomNo) {
      filter["bedId.roomNo"] = roomNo;
    }
    if (bedNo) {
      const beds = await Bed.find({ bedNo }).select("_id");

      filter.bedId = {
        $in: beds.map((b) => b._id),
      };
    }

    // Temporary property filters
    if (temporaryPropertyId) {
      filter.temporaryPropertyId = temporaryPropertyId;
    }
    if (temporaryBedNo) {
      const beds = await Bed.find({
        bedNo: temporaryBedNo,
      }).select("_id");

      filter.temporaryBedId = {
        $in: beds.map((b) => b._id),
      };
    }

    // Date filters
    if (clientDojFrom || clientDojTo) {
      filter.clientDoj = {};

      if (clientDojFrom) {
        filter.clientDoj.$gte = clientDojFrom;
      }

      if (clientDojTo) {
        filter.clientDoj.$lte = clientDojTo;
      }
    }
    if (temporaryClientDojFrom || temporaryClientDojTo) {
      filter.temporaryClientDoj = {};

      if (temporaryClientDojFrom) {
        filter.temporaryClientDoj.$gte = temporaryClientDojFrom;
      }

      if (temporaryClientDojTo) {
        filter.temporaryClientDoj.$lte = temporaryClientDojTo;
      }
    }

    // Amount filters
    if (monthlyRentMin || monthlyRentMax) {
      filter.monthlyRent = {};
      if (monthlyRentMin) {
        filter.monthlyRent.$gte = parseFloat(monthlyRentMin);
      }
      if (monthlyRentMax) {
        filter.monthlyRent.$lte = parseFloat(monthlyRentMax);
      }
    }

    if (depositAmountMin || depositAmountMax) {
      filter.depositAmount = {};
      if (depositAmountMin) {
        filter.depositAmount.$gte = parseFloat(depositAmountMin);
      }
      if (depositAmountMax) {
        filter.depositAmount.$lte = parseFloat(depositAmountMax);
      }
    }

    if (processingFeesMin || processingFeesMax) {
      filter.processingFees = {};
      if (processingFeesMin) {
        filter.processingFees.$gte = parseFloat(processingFeesMin);
      }
      if (processingFeesMax) {
        filter.processingFees.$lte = parseFloat(processingFeesMax);
      }
    }

    if (totalAmountMin || totalAmountMax) {
      filter.totalAmount = {};
      if (totalAmountMin) {
        filter.totalAmount.$gte = parseFloat(totalAmountMin);
      }
      if (totalAmountMax) {
        filter.totalAmount.$lte = parseFloat(totalAmountMax);
      }
    }

    if (bookingAmountMin || bookingAmountMax) {
      filter.bookingAmount = {};
      if (bookingAmountMin) {
        filter.bookingAmount.$gte = parseFloat(bookingAmountMin);
      }
      if (bookingAmountMax) {
        filter.bookingAmount.$lte = parseFloat(bookingAmountMax);
      }
    }

    if (balanceAmountMin || balanceAmountMax) {
      filter.balanceAmount = {};
      if (balanceAmountMin) {
        filter.balanceAmount.$gte = parseFloat(balanceAmountMin);
      }
      if (balanceAmountMax) {
        filter.balanceAmount.$lte = parseFloat(balanceAmountMax);
      }
    }

    // ================= Global Search =================
    if (search) {
      const searchText = search.trim();
      const searchRegex = new RegExp(searchText, "i");

      // Find matching properties
      const matchingProperties = await Property.find({
        $or: [{ propertyCode: searchRegex }, { propertyLocation: searchRegex }],
      }).select("_id");

      // Find matching beds
      const matchingBeds = await Bed.find({
        $or: [{ bedNo: searchRegex }, { roomNo: searchRegex }],
      }).select("_id");

      const propertyIds = matchingProperties.map((p) => p._id);
      const bedIds = matchingBeds.map((b) => b._id);

      filter.$or = [
        { fullName: searchRegex },
        { callingNo: searchRegex },
        { whatsappNo: searchRegex },

        { propertyId: { $in: propertyIds } },
        { temporaryPropertyId: { $in: propertyIds } },

        { bedId: { $in: bedIds } },
        { temporaryBedId: { $in: bedIds } },
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitValue = parseInt(limit);

    // Execute query with population
    let query = Booking.find(filter)
      .populate("propertyId", "propertyCode propertyLocation")
      .populate("bedId", "bedNo roomNo")
      .populate("temporaryPropertyId", "propertyCode")
      .populate("temporaryBedId", "bedNo roomNo")
      .sort({ createdAt: -1 });

    // Get total count for pagination
    const totalCount = await Booking.countDocuments(filter);

    // Apply pagination
    query = query.skip(skip).limit(limitValue);

    const bookings = await query;

    res.status(200).json({
      success: true,
      count: bookings.length,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limitValue),
      currentPage: parseInt(page),
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// GET SINGLE BOOKING
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("propertyId")
      .populate("bedId")
      .populate("temporaryPropertyId")
      .populate("temporaryBedId");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// UPDATE BOOKING
exports.updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    booking.isCancelled = true;
    booking.cancelledDate = new Date();
    booking.loginEnabled = false;

    await booking.save();

    await Client.updateMany(
      { bookingId: booking._id },
      {
        $set: {
          loginEnabled: false,
          isBookingCancelled: true,
        },
      }
    );

    // 👇 User ko bhi inactive karo
    await User.findOneAndUpdate(
      { bookingId: booking._id },
      {
        $set: {
          isActive: false,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE BOOKING
exports.deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(
      req.params.id
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};