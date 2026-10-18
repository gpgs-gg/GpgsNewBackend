const Booking = require("../models/newBooking.model");
const Client = require("../models/client.model");
const User = require("../models/user.model");
const Property = require("../models/property.model")
const Bed = require("../models/bed.model");
const { createWorkLog, generateWorkLogs } = require("../utils/worklog");
const Employee = require("../models/employee.model");




// // Generate Dummy Bulk Bookings
// exports.generateDummyBulkBookings = async (req, res) => {
//   try {
//     const totalRecords = Math.min(
//       Math.max(parseInt(req.body.totalRecords) || 1000, 1),
//       10000
//     );

//     const batchSize = 500;

//     const PROPERTY_ID = "6aa39ed1dcc10950de7a7327";
//     const BED_ID = "6aca26ce406305fa1b249988";

//     const createdByName =
//       req.body.createdByName || "Bulk Testing";

//     let totalInserted = 0;
//     let totalFailed = 0;
//     const errors = [];

//     for (
//       let start = 0;
//       start < totalRecords;
//       start += batchSize
//     ) {
//       const currentBatchSize = Math.min(
//         batchSize,
//         totalRecords - start
//       );

//       const bookings = Array.from(
//         { length: currentBatchSize },
//         (_, index) => {
//           const number = start + index + 1;
//           const uniqueId = `${Date.now()}${number}`;

//           return {
//             fullName: `Test Client ${number}`,
//             emailId: `testclient${uniqueId}@example.com`,

//             callingNo: String(
//               7000000000 + (number % 1000000000)
//             ),
//             whatsappNo: String(
//               7000000000 + (number % 1000000000)
//             ),

//             teamCode: "",
//             askFor: "BA",

//             emergencyContact1FullName:
//               `Emergency Contact ${number}`,
//             emergencyContact1No: String(
//               8000000000 + (number % 1000000000)
//             ),

//             emergencyContact2FullName:
//               `Secondary Contact ${number}`,
//             emergencyContact2No: String(
//               9000000000 + (number % 1000000000)
//             ),

//             propertyId: PROPERTY_ID,
//             bedId: BED_ID,

//             monthlyRent: 14000,
//             depositAmount: 28000,
//             clientCalculatedRent: 14000,

//             clientDoj: "2026-11-01",
//             clientLastDate: null,

//             parkingCharges: 0,
//             processingFees: 500,

//             totalAmount: 42500,
//             bookingAmount: 14000,
//             balanceAmount: 28500,

//             temporaryClientDoj: null,
//             temporaryClientLastDate: null,
//             temporaryParkingCharges: 0,
//             temporaryTotalAmount: 0,

//             partialAmount: 0,
//             URHA: 0,
//             URHD: "-",

//             loginEnabled: true,
//             paymentAttachment: [],

//             isCancelled: false,
//             bookingType: null,
//             cancelledDate: null,
//             status: "Booked",

//             workLogs: [
//               {
//                 message: `Booking created by ${createdByName}`,
//                 createdBy: createdByName,
//               },
//             ],
//           };
//         }
//       );

//       try {
//         const result = await Booking.insertMany(bookings, {
//           ordered: false,
//         });

//         totalInserted += result.length;
//       } catch (error) {
//         // unordered insertMany can insert valid documents
//         // even when some documents fail validation.
//         const insertedCount =
//           error.insertedDocs?.length || 0;

//         totalInserted += insertedCount;

//         const failedCount = Math.max(
//           currentBatchSize - insertedCount,
//           0
//         );

//         totalFailed += failedCount;

//         errors.push({
//           batch: Math.floor(start / batchSize) + 1,
//           attempted: currentBatchSize,
//           inserted: insertedCount,
//           failed: failedCount,
//           message: error.message,
//         });
//       }
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Dummy bulk booking generation completed",
//       summary: {
//         requested: totalRecords,
//         inserted: totalInserted,
//         failed: totalFailed,
//       },
//       errors,
//     });
//   } catch (error) {
//     console.error("Generate Dummy Bookings Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };



exports.createBooking = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    const loggedInUser = await User.findById(userId).select("name employeeId");

    const user = req.body.createdByName || req.body.updatedByName || "System";
    // ============================================================
    // GET TEAM CODE FROM EMPLOYEE
    // ============================================================
    let teamCode = "";

    if (loggedInUser?.employeeId) {
      const employee = await Employee.findById(loggedInUser.employeeId).select(
        "teamCode",
      );

      teamCode = employee?.teamCode || "";
    }
    if (req.user?.employeeId) {
      const employee = await Employee.findById(req.user.employeeId).select(
        "teamCode",
      );

      teamCode = employee?.teamCode || "";
    }
    const booking = await Booking.create({ ...req.body, teamCode });
    // Worklog for booking creation
    booking.workLogs.push(
      createWorkLog({
        message: `Booking created by ${user}`,
        createdBy: user,
      }),
    );
    await booking.save();
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
      teamCode,
      sharingType,
      paymentStatus,
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
      // Today's bookings
      todayBookings,
      // Pagination
      page = 1,
      limit = 10,
      search = "",
      bookingCreatedFrom,
      bookingCreatedTo,
    } = req.query;

    // Build filter object
    let filter = {};
    // Today's bookings = bookings created today
    if (todayBookings === "true") {
      const now = new Date();

      const indiaDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);

      const startOfToday = new Date(`${indiaDate}T00:00:00+05:30`);
      const startOfTomorrow = new Date(`${indiaDate}T00:00:00+05:30`);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

      filter.createdAt = {
        $gte: startOfToday,
        $lt: startOfTomorrow,
      };
    }
    // Booking Created Date filter
    if (bookingCreatedFrom || bookingCreatedTo) {
      filter.createdAt = {};

      if (bookingCreatedFrom) {
        filter.createdAt.$gte = new Date(
          `${bookingCreatedFrom}T00:00:00+05:30`,
        );
      }

      if (bookingCreatedTo) {
        const endDate = new Date(`${bookingCreatedTo}T00:00:00+05:30`);

        endDate.setDate(endDate.getDate() + 1);

        filter.createdAt.$lt = endDate;
      }
    }

    if (propertyLocation) {
      const locations = (
        Array.isArray(propertyLocation)
          ? propertyLocation
          : propertyLocation.split(",")
      )
        .map((location) => location.trim())
        .filter(Boolean);

      const properties = await Property.find({
        propertyLocation: { $in: locations },
      }).select("_id");

      filter.propertyId = {
        $in: properties.map((p) => p._id),
      };
    }

    if (sharingType) {
      const sharingTypes = (
        Array.isArray(sharingType) ? sharingType : sharingType.split(",")
      )
        .map((type) => type.trim())
        .filter(Boolean);

      const matchingBeds = await Bed.find({
        sharingType: { $in: sharingTypes },
      }).select("_id");

      filter.bedId = {
        $in: matchingBeds.map((bed) => bed._id),
      };
    }


    // Text filters (case-insensitive regex)
    if (fullName) {
      filter.fullName = { $regex: fullName, $options: "i" };
    }
    if (teamCode) {
      filter.teamCode = {
        $regex: `^${teamCode}$`,
        $options: "i",
      };
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

    // Payment Verification filter
    // loginEnabled is used as the payment verification flag
    if (paymentStatus === "Verified") {
      filter.loginEnabled = true;
    }
    if (paymentStatus === "Pending") {
      filter.loginEnabled = false;
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
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }
    const user =
      req.body.updatedByName ||
      req.body.createdByName ||
      req.user?.name ||
      req.body?.user ||
      "system";
    let workLogs = booking.workLogs || [];
    // ============================================================
    // PREPARE NEW DATA FOR WORKLOG COMPARISON
    // ============================================================
    const updateData = {
      ...req.body,
    };
    delete updateData.newWorkLog;
    delete updateData.createdByName;
    delete updateData.updatedByName;
    delete updateData.workLogs;

    // Merge existing booking with partial update data.
    // This prevents unchanged fields from becoming "Blank"
    // when they are not included in req.body.
    const newBookingData = {
      ...booking.toObject(),
      ...updateData,
    };
    // ============================================================
    // CONVERT PROPERTY ID / BED ID TO DISPLAY VALUES FOR WORKLOG
    // ============================================================
    const oldBookingData = booking.toObject();
    // OLD PROPERTY
    if (oldBookingData.propertyId) {
      const oldProperty = await Property.findById(oldBookingData.propertyId);

      if (oldProperty) {
        oldBookingData.propertyId = oldProperty.propertyCode;
      }
    }

    // OLD BED
    if (oldBookingData.bedId) {
      const oldBed = await Bed.findById(oldBookingData.bedId);

      if (oldBed) {
        oldBookingData.bedId = oldBed.bedNo;
      }
    }

    // NEW PROPERTY
    if (newBookingData.propertyId) {
      const newProperty = await Property.findById(newBookingData.propertyId);

      if (newProperty) {
        newBookingData.propertyId = newProperty.propertyCode;
      }
    }

    // NEW BED
    if (newBookingData.bedId) {
      const newBed = await Bed.findById(newBookingData.bedId);

      if (newBed) {
        newBookingData.bedId = newBed.bedNo;
      }
    }

    // OLD TEMPORARY PROPERTY
    if (oldBookingData.temporaryPropertyId) {
      const oldTemporaryProperty = await Property.findById(
        oldBookingData.temporaryPropertyId,
      );

      if (oldTemporaryProperty) {
        oldBookingData.temporaryPropertyId = oldTemporaryProperty.propertyCode;
      }
    }

    // OLD TEMPORARY BED
    if (oldBookingData.temporaryBedId) {
      const oldTemporaryBed = await Bed.findById(oldBookingData.temporaryBedId);

      if (oldTemporaryBed) {
        oldBookingData.temporaryBedId = oldTemporaryBed.bedNo;
      }
    }

    // NEW TEMPORARY PROPERTY
    if (newBookingData.temporaryPropertyId) {
      const newTemporaryProperty = await Property.findById(
        newBookingData.temporaryPropertyId,
      );

      if (newTemporaryProperty) {
        newBookingData.temporaryPropertyId = newTemporaryProperty.propertyCode;
      }
    }

    // NEW TEMPORARY BED
    if (newBookingData.temporaryBedId) {
      const newTemporaryBed = await Bed.findById(newBookingData.temporaryBedId);

      if (newTemporaryBed) {
        newBookingData.temporaryBedId = newTemporaryBed.bedNo;
      }
    }


    // ============================================================
    // LOGIN ENABLED WORKLOG
    // ============================================================

    if (
      oldBookingData.loginEnabled === false &&
      newBookingData.loginEnabled === true
    ) {
      workLogs.push(
        createWorkLog({
          message: `Login Enabled changed from "No" to "Yes"`,
          createdBy: user,
        }),
      );
    }
    // ============================================================
    // AUTOMATIC WORKLOG FOR EVERY CHANGED FIELD
    // ============================================================

    const automaticWorkLogs = generateWorkLogs({
      oldData: oldBookingData,
      newData: newBookingData,
      createdBy: user,

      ignoredFields: [
        "newWorkLog",
        "workLogs",

        // System fields
        "createdAt",
        "updatedAt",
        "__v",
        "_id",

        // User/helper fields
        "createdByName",
        "updatedByName",
        "user",
        "roomNo",
        "acRoom",
      ],
    });

    workLogs.push(...automaticWorkLogs);

    // ============================================================
    // MANUAL WORKLOG
    // ============================================================

    const newWorkLog = String(req.body.newWorkLog || "").trim();

    if (newWorkLog) {
      workLogs.push(
        createWorkLog({
          message: newWorkLog,
          createdBy: user,
        }),
      );
    }
    // ============================================================
    // UPDATE BOOKING
    // ============================================================
    Object.assign(booking, updateData);
    booking.workLogs = workLogs;
    if (booking.loginEnabled === false) {
      booking.workLogs = booking.workLogs || [];
      booking.workLogs.push(
        createWorkLog({
          message: `Payment verification Changed From Pending to Verified"`,
          createdBy:
            req.body.user ||
            req.body.updatedByName ||
            req.user?.name ||
            "system",
        }),
      );
    }

    await booking.save();

    const updatedBooking = await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: updatedBooking,
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