
const Client = require("../models/client.model");
const Bed = require("../models/bed.model");
const User = require("../models/user.model");
const Property = require("../models/property.model");
const Booking = require("../models/newBooking.model");
const { recalculateRentHistory } = require("../services/rentHistory.service");
const { enableClientLogin } = require("../services/clientLogin.service");
const {
  createClientRentHistory,
} = require("../services/rentHistory.service");
const uploadFile = require("../services/uploadFile");

const ClientRentHistory = require("../models/clientRentHistory.model");


  exports.createDummyClients = async (req, res) => {
    try {
      const clients = [];

      for (let i = 1; i <= 20000; i++) {
        clients.push({
          propertyId: "6a5f00cf449ad08b14340eca",
          bedId: "6a5f02c8449ad08b14340ecb",
          bookingId: "6a4f785416d15e9afa6e829e",

          stayType: "P. Booked",
          status: "Booked",
          isBookingCancelled: false,

          fullName: `Dummy Client ${i}`,
          whatsappNo: `9000${String(i).padStart(6, "0")}`,
          callingNo: `9000${String(i).padStart(6, "0")}`,
          emailId: `dummy${i}@gmail.com`,

          monthlyRent: 8000,
          depositAmount: 16000,
          parkingCharges: 100,
          processingFees: 500,

          clientDoj: new Date("2026-06-15"),

          totalAmount: 24600,
          bookingAmount: 2000,
          balanceAmount: 22600,

          photo: [],
          aadhaarCard: [],
          pan: [],
          collegeIdentification: [],
          companyIdentification: [],
          clientRentalAgreement: [],
          clientPoliceNOC: [],
          attachments: [],
          bedHistory: [],
          worklogs: [],
        });
      }

      const result = await Client.insertMany(clients);

      return res.status(200).json({
        success: true,
        message: `${result.length} Dummy Clients Created`,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

exports.createClientFromBooking = async (
  req,
  res
) => {
  try {
    const { bookingId } = req.body;

    const booking =
      await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const email = booking.emailId?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const activeUser = await User.findOne({
      email,
      isActive: true,
    }).lean();

    if (activeUser) {
      return res.status(409).json({
        success: false,
        message: "An active account already exists with this email address, please change this email.",
      });
    }

    // =========================
    // REACTIVATE OLD CLIENTS
    // =========================
    const existingClients = await Client.find({
      bookingId,
    });

    if (existingClients.length > 0) {

      // Booking ki latest values client me update karo
      for (const client of existingClients) {

        if (client.stayType === "P. Booked") {

          client.bookingId = booking._id;

          client.fullName = booking.fullName;
          client.emailId = booking.emailId;
          client.callingNo = booking.callingNo;
          client.whatsappNo = booking.whatsappNo;

          client.propertyId = booking.propertyId;
          client.bedId = booking.bedId;

          client.processingFees = booking.processingFees;
          client.parkingCharges = booking.parkingCharges;

          client.monthlyRent = booking.monthlyRent;
          client.depositAmount = booking.depositAmount;

          client.totalAmount = booking.totalAmount;
          client.bookingAmount = booking.bookingAmount;
          client.balanceAmount = booking.balanceAmount;
          client.temporaryTotalAmount = booking.temporaryTotalAmount;
          client.clientDoj = booking.clientDoj;
          // client.clientVacatingDate = booking.clientLastDate;
          // client.noticeStartDate = booking.clientDoj;
          // client.noticeLastDate = booking.clientLastDate;
          client.comments = booking.comments;
          client.loginEnabled = true;
          client.isBookingCancelled = false;
        }

        if (client.stayType === "T. Booked") {

          client.bookingId = booking._id;

          client.fullName = booking.fullName;
          client.emailId = booking.emailId;
          client.callingNo = booking.callingNo;
          client.whatsappNo = booking.whatsappNo;

          client.propertyId = booking.temporaryPropertyId;
          client.bedId = booking.temporaryBedId;

          client.monthlyRent = booking.temporaryMonthlyRent;

          client.temporaryParkingCharges =
            booking.temporaryParkingCharges;

          client.temporaryTotalAmount =
            booking.temporaryTotalAmount;

          client.clientDoj =
            booking.temporaryClientDoj;

          client.clientVacatingDate =
            booking.temporaryClientLastDate;

          client.noticeStartDate =
            booking.temporaryClientDoj;

          client.noticeLastDate =
            booking.temporaryClientLastDate;

          client.comments =
            booking.temporaryComments;

          client.loginEnabled = true;
          client.isBookingCancelled = false;
        }

        await client.save();

        await createClientRentHistory(client, true);
      }

      await User.findOneAndUpdate(
        { bookingId },
        {
          $set: {
            isActive: true,
          },
        }
      );

      booking.loginEnabled = true;
      booking.isCancelled = false;
      booking.cancelledDate = null;

      await booking.save();

      return res.status(200).json({
        success: true,
        message: "Client & Rent History updated successfully",
      });
    }

    // =========================
    // ALREADY BOOKED CHECK
    // =========================

    if (
      booking.loginEnabled &&
      !booking.isCancelled
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This booking is already converted to client",
      });
    }

    const clientsToCreate = [];

    // =========================
    // PERMANENT BED CHECK
    // =========================

    if (
      booking.propertyId &&
      booking.bedId
    ) {
      const occupiedPermanentBed =
        await Client.findOne({
          propertyId: booking.propertyId,
          bedId: booking.bedId,
          isBookingCancelled: false,

          $or: [
            {
              noticeStartDate: {
                $exists: false,
              },
            },
            {
              noticeStartDate: null,
            },
          ],
        });

      if (occupiedPermanentBed) {
        return res.status(400).json({
          success: false,
          message:
            "Permanent bed is already occupied",
        });
      }

      clientsToCreate.push({
        stayType: "P. Booked",
        bookingId: booking._id,
        fullName: booking.fullName,
        emailId: booking.emailId,
        callingNo: booking.callingNo,
        whatsappNo: booking.whatsappNo,
        propertyId: booking.propertyId,
        bedId: booking.bedId,
        processingFees: booking.processingFees,
        parkingCharges: booking.parkingCharges,
        monthlyRent: booking.monthlyRent,
        depositAmount: booking.depositAmount,
        totalAmount: booking.totalAmount,
        bookingAmount: booking.bookingAmount,
        balanceAmount: booking.balanceAmount,
        temporaryTotalAmount: booking.temporaryTotalAmount,
        clientDoj: booking.clientDoj,
        // clientVacatingDate: booking.clientLastDate,
        // noticeStartDate: booking.clientDoj,
        // noticeLastDate: booking.clientLastDate,
        comments: booking.comments,
        loginEnabled: true,
        isBookingCancelled: false,
      });
    }

    // =========================
    // TEMPORARY BED CHECK
    // =========================

    if (
      booking.temporaryPropertyId &&
      booking.temporaryBedId
    ) {
      const occupiedTemporaryBed =
        await Client.findOne({
          propertyId:
            booking.temporaryPropertyId,
          bedId:
            booking.temporaryBedId,

          isBookingCancelled: false,

          $or: [
            {
              noticeStartDate: {
                $exists: false,
              },
            },
            {
              noticeStartDate: null,
            },
          ],
        });

      if (occupiedTemporaryBed) {
        return res.status(400).json({
          success: false,
          message:
            "Temporary bed is already occupied",
        });
      }

      clientsToCreate.push({
        stayType: "T. Booked",
        bookingId: booking._id,
        fullName: booking.fullName,
        emailId: booking.emailId,
        callingNo: booking.callingNo,
        whatsappNo: booking.whatsappNo,
        propertyId: booking.temporaryPropertyId,
        bedId: booking.temporaryBedId,
        monthlyRent: booking.temporaryMonthlyRent,
        temporaryParkingCharges: booking.temporaryParkingCharges,
        temporaryTotalAmount: booking.temporaryTotalAmount,
        clientDoj: booking.temporaryClientDoj,
        clientVacatingDate: booking.temporaryClientLastDate,
        noticeStartDate: booking.temporaryClientDoj,
        noticeLastDate: booking.temporaryClientLastDate,
        comments:
          booking.temporaryComments,
        loginEnabled: true,
        isBookingCancelled: false,
      });
    }

    // =========================
    // CREATE CLIENTS
    // =========================

    const clients =
      await Client.insertMany(
        clientsToCreate
      );
    for (const client of clients) {
      await createClientRentHistory(client);
    }

    // booking.status = "Booked";
    // booking.isCancelled = false;
    // booking.cancelledDate = null;

    await booking.save();

    // 👇 Direct service call
    await enableClientLogin(booking._id);

    return res.status(201).json({
      success: true,
      message:
        "Client created successfully",
      data: clients,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// exports.createClientFromBooking = async (
//   req,
//   res
// ) => {
//   try {
//     const { bookingId } = req.body;

//     const booking =
//       await Booking.findById(bookingId);

//     if (!booking) {
//       return res.status(404).json({
//         success: false,
//         message: "Booking not found",
//       });
//     }

//     // =========================
//     // REACTIVATE OLD CLIENTS
//     // =========================

//     const existingClients =
//       await Client.find({
//         bookingId,
//       });

//     if (existingClients.length > 0) {
//       await Client.updateMany(
//         { bookingId },
//         {
//           $set: {
//             loginEnabled: true,
//             isBookingCancelled: false,
//           },
//         }
//       );
//       await User.findOneAndUpdate(
//         { bookingId },
//         {
//           $set: {
//             isActive: true,
//           },
//         }
//       );
//       booking.loginEnabled = true;
//       booking.isCancelled = false;
//       booking.cancelledDate = null;

//       await booking.save();

//       return res.status(200).json({
//         success: true,
//         message:
//           "Existing clients reactivated successfully",
//       });
//     }

//     // =========================
//     // ALREADY BOOKED CHECK
//     // =========================

//     if (
//       booking.loginEnabled &&
//       !booking.isCancelled
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "This booking is already converted to client",
//       });
//     }

//     const clientsToCreate = [];

//     // =========================
//     // PERMANENT BED CHECK
//     // =========================

//     if (
//       booking.propertyId &&
//       booking.bedId
//     ) {
//       const occupiedPermanentBed =
//         await Client.findOne({
//           propertyId: booking.propertyId,
//           bedId: booking.bedId,
//           isBookingCancelled: false,

//           $or: [
//             {
//               noticeStartDate: {
//                 $exists: false,
//               },
//             },
//             {
//               noticeStartDate: null,
//             },
//           ],
//         });

//       if (occupiedPermanentBed) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "Permanent bed is already occupied",
//         });
//       }

//       clientsToCreate.push({
//         stayType: "P. Booked",
//         bookingId: booking._id,
//         fullName: booking.fullName,
//         emailId: booking.emailId,
//         callingNo: booking.callingNo,
//         whatsappNo: booking.whatsappNo,
//         propertyId: booking.propertyId,
//         bedId: booking.bedId,
//         processingFees: booking.processingFees,
//         parkingCharges: booking.parkingCharges,
//         monthlyRent: booking.monthlyRent,
//         depositAmount: booking.depositAmount,
//         totalAmount: booking.totalAmount,
//         bookingAmount: booking.bookingAmount,
//         balanceAmount: booking.balanceAmount,
//         temporaryTotalAmount: booking.temporaryTotalAmount,
//         clientDoj: booking.clientDoj,
//         clientVacatingDate: booking.clientLastDate,
//         noticeStartDate: booking.clientDoj,
//         noticeLastDate: booking.clientLastDate,
//         comments: booking.comments,
//         loginEnabled: true,
//         isBookingCancelled: false,
//       });
//     }

//     // =========================
//     // TEMPORARY BED CHECK
//     // =========================

//     if (
//       booking.temporaryPropertyId &&
//       booking.temporaryBedId
//     ) {
//       const occupiedTemporaryBed =
//         await Client.findOne({
//           propertyId:
//             booking.temporaryPropertyId,
//           bedId:
//             booking.temporaryBedId,

//           isBookingCancelled: false,

//           $or: [
//             {
//               noticeStartDate: {
//                 $exists: false,
//               },
//             },
//             {
//               noticeStartDate: null,
//             },
//           ],
//         });

//       if (occupiedTemporaryBed) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "Temporary bed is already occupied",
//         });
//       }

//       clientsToCreate.push({
//         stayType: "T. Booked",
//         bookingId: booking._id,
//         fullName: booking.fullName,
//         emailId: booking.emailId,
//         callingNo: booking.callingNo,
//         whatsappNo: booking.whatsappNo,
//         propertyId: booking.temporaryPropertyId,
//         bedId: booking.temporaryBedId,
//         monthlyRent: booking.temporaryMonthlyRent,
//         temporaryParkingCharges: booking.temporaryParkingCharges,
//         temporaryTotalAmount: booking.temporaryTotalAmount,
//         clientDoj: booking.temporaryClientDoj,
//         clientVacatingDate: booking.temporaryClientLastDate,
//         noticeStartDate: booking.temporaryClientDoj,
//         noticeLastDate: booking.temporaryClientLastDate,
//         comments:
//           booking.temporaryComments,
//         loginEnabled: true,
//         isBookingCancelled: false,
//       });
//     }

//     // =========================
//     // CREATE CLIENTS
//     // =========================

//     const clients =
//       await Client.insertMany(
//         clientsToCreate
//       );
//     for (const client of clients) {
//       await createClientRentHistory(client);
//     }

//     // booking.status = "Booked";
//     // booking.isCancelled = false;
//     // booking.cancelledDate = null;

//     await booking.save();

//     // 👇 Direct service call
//     await enableClientLogin(booking._id);

//     return res.status(201).json({
//       success: true,
//       message:
//         "Client created successfully",
//       data: clients,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


exports.createClient = async (req, res) => {
  try {
    const {
      fullName,
      callingNo,
      propertyId,
      bedId,
      temporaryPropertyId,
      temporaryBedId,
      clientDoj,
      temporaryClientDoj,
      temporaryClientLastDate,
    } = req.body;

    if (!fullName || !callingNo) {
      return res.status(400).json({
        success: false,
        message: "Full Name and Calling No are required",
      });
    }

    const clientsToCreate = [];

    // =========================
    // PERMANENT CLIENT
    // =========================
    if (propertyId && bedId) {
      const property = await Property.findById(propertyId);

      if (!property) {
        return res.status(404).json({
          success: false,
          message: "Permanent property not found",
        });
      }

      const bed = await Bed.findOne({
        _id: bedId,
        propertyId,
      });

      if (!bed) {
        return res.status(404).json({
          success: false,
          message: "Permanent bed not found",
        });
      }

      clientsToCreate.push({
        ...req.body,
        propertyId,
        bedId,
        clientDoj: clientDoj || new Date(),
        isBookingStatus: false,
      });
    }

    // =========================
    // TEMPORARY CLIENT
    // =========================
    if (
      temporaryPropertyId &&
      temporaryBedId
    ) {
      const tempProperty =
        await Property.findById(
          temporaryPropertyId
        );

      if (!tempProperty) {
        return res.status(404).json({
          success: false,
          message: "Temporary property not found",
        });
      }

      const tempBed = await Bed.findOne({
        _id: temporaryBedId,
        propertyId: temporaryPropertyId,
      });

      if (!tempBed) {
        return res.status(404).json({
          success: false,
          message: "Temporary bed not found",
        });
      }

      clientsToCreate.push({
        ...req.body,

        propertyId: temporaryPropertyId,
        bedId: temporaryBedId,

        clientDoj:
          temporaryClientDoj,

        clientVacatingDate:
          temporaryClientLastDate,

        isBookingStatus: false,
      });
    }

    if (clientsToCreate.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No valid Permanent or Temporary bed found",
      });
    }

    const clients =
      await Client.insertMany(
        clientsToCreate
      );

    // Create current month rent history
    for (const client of clients) {
      await createClientRentHistory(client);
    }


    res.status(201).json({
      success: true,
      message: `${clients.length} client record(s) created successfully`,
      data: clients,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// ======================================
// GET ALL CLIENTS
// ======================================

exports.getClients = async (req, res) => {
  try {
    // ================= Pagination =================
    const page = Math.max(parseInt(req.query.page) || 1, 1);// current page no.
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);// no. of records per page
    const skip = (page - 1) * limit;

    // ================= Base Query =================
    const query = {};

    // ================= Global Search =================
    if (req.query.search?.trim()) {
      const search = req.query.search.trim();
      // search conditions if any field matches
      const searchConditions = [
        { fullName: { $regex: search, $options: "i" } },
        { callingNo: { $regex: search, $options: "i" } },
        { whatsappNo: { $regex: search, $options: "i" } },
        { emailId: { $regex: search, $options: "i" } },
        { occupation: { $regex: search, $options: "i" } },
        { organization: { $regex: search, $options: "i" } },
        { stayType: { $regex: search, $options: "i" } },
      ];

      // Search Property Collection
      const properties = await Property.find({
        $or: [
          {
            propertyCode: {
              $regex: search,
              $options: "i",
            },
          },
          {
            propertyLocation: {
              $regex: search,
              $options: "i",
            },
          },
        ],
      }).select("_id");

      if (properties.length) {
        searchConditions.push({
          propertyId: {
            $in: properties.map((p) => p._id),
          },
        });
      }

      // Search Bed Collection
      const bedQuery = {
        $or: [
          {
            roomNo: {
              $regex: search,
              $options: "i",
            },
          },
          {
            bedNo: {
              $regex: search,
              $options: "i",
            },
          },
        ],
      };

      // Numeric search
      if (!isNaN(search)) {
        const number = Number(search);

        bedQuery.$or.push({ monthlyRent: number }, { depositAmount: number });
      }

      const beds = await Bed.find(bedQuery).select("_id");

      if (beds.length) {
        searchConditions.push({
          bedId: {
            $in: beds.map((b) => b._id),
          },
        });
      }

      // Parking Charges Search
      if (!isNaN(search)) {
        searchConditions.push({
          parkingCharges: Number(search),
        });
      }

      query.$or = searchConditions;
    }

    // ======================================================
    // PART 2 STARTS HERE
    // (Backend Filters)
    // ======================================================
    // ================= Filters =================

    // Property
    if (req.query.propertyId) {
      query.propertyId = req.query.propertyId;
    }

    // Property Location
    if (req.query.propertyLocation) {
      const properties = await Property.find({
        propertyLocation: req.query.propertyLocation,
      }).select("_id");

      query.propertyId = {
        $in: properties.map((p) => p._id),
      };
    }

    // Stay Type
    if (req.query.stayType) {
      query.stayType = req.query.stayType;
    }

    // Login Enabled
    if (req.query.loginEnabled !== undefined && req.query.loginEnabled !== "") {
      query.loginEnabled = req.query.loginEnabled === "true";
    }

    // Booking Cancelled
    if (
      req.query.isBookingCancelled !== undefined &&
      req.query.isBookingCancelled !== ""
    ) {
      query.isBookingCancelled = req.query.isBookingCancelled === "true";
    }

    // Room No
    if (req.query.roomNo) {
      const beds = await Bed.find({
        roomNo: req.query.roomNo,
      }).select("_id");

      query.bedId = {
        $in: beds.map((b) => b._id),
      };
    }

    // Bed No
    if (req.query.bedNo) {
      const beds = await Bed.find({
        bedNo: req.query.bedNo,
      }).select("_id");

      query.bedId = {
        $in: beds.map((b) => b._id),
      };
    }

    // ================= Monthly Rent =================

    if (req.query.monthlyRentMin || req.query.monthlyRentMax) {
      const bedQuery = {};

      bedQuery.monthlyRent = {};

      if (req.query.monthlyRentMin) {
        bedQuery.monthlyRent.$gte = Number(req.query.monthlyRentMin);
      }

      if (req.query.monthlyRentMax) {
        bedQuery.monthlyRent.$lte = Number(req.query.monthlyRentMax);
      }

      const beds = await Bed.find(bedQuery).select("_id");

      query.bedId = {
        $in: beds.map((b) => b._id),
      };
    }

    // ================= Deposit =================

    if (req.query.depositAmountMin || req.query.depositAmountMax) {
      const bedQuery = {};

      bedQuery.depositAmount = {};

      if (req.query.depositAmountMin) {
        bedQuery.depositAmount.$gte = Number(req.query.depositAmountMin);
      }

      if (req.query.depositAmountMax) {
        bedQuery.depositAmount.$lte = Number(req.query.depositAmountMax);
      }

      const beds = await Bed.find(bedQuery).select("_id");

      query.bedId = {
        $in: beds.map((b) => b._id),
      };
    }

    // ================= Parking Charges =================

    if (req.query.parkingChargesMin || req.query.parkingChargesMax) {
      query.parkingCharges = {};

      if (req.query.parkingChargesMin) {
        query.parkingCharges.$gte = Number(req.query.parkingChargesMin);
      }

      if (req.query.parkingChargesMax) {
        query.parkingCharges.$lte = Number(req.query.parkingChargesMax);
      }
    }

    // ================= Client DOJ =================

    if (req.query.clientDojFrom || req.query.clientDojTo) {
      query.clientDoj = {};

      if (req.query.clientDojFrom) {
        query.clientDoj.$gte = req.query.clientDojFrom;
      }

      if (req.query.clientDojTo) {
        query.clientDoj.$lte = req.query.clientDojTo;
      }
    }

    // ================= EB DOJ =================

    if (req.query.ebDojFrom || req.query.ebDojTo) {
      query.ebDoj = {};

      if (req.query.ebDojFrom) {
        query.ebDoj.$gte = req.query.ebDojFrom;
      }

      if (req.query.ebDojTo) {
        query.ebDoj.$lte = req.query.ebDojTo;
      }
    }

    // ================= Notice Start =================

    if (req.query.noticeStartDateFrom || req.query.noticeStartDateTo) {
      query.noticeStartDate = {};

      if (req.query.noticeStartDateFrom) {
        query.noticeStartDate.$gte = req.query.noticeStartDateFrom;
      }

      if (req.query.noticeStartDateTo) {
        query.noticeStartDate.$lte = req.query.noticeStartDateTo;
      }
    }

    // ================= Notice Last =================

    if (req.query.noticeLastDateFrom || req.query.noticeLastDateTo) {
      query.noticeLastDate = {};

      if (req.query.noticeLastDateFrom) {
        query.noticeLastDate.$gte = req.query.noticeLastDateFrom;
      }

      if (req.query.noticeLastDateTo) {
        query.noticeLastDate.$lte = req.query.noticeLastDateTo;
      }
    }

    // ================= Client Vacating =================

    if (req.query.clientVacatingDateFrom || req.query.clientVacatingDateTo) {
      query.clientVacatingDate = {};

      if (req.query.clientVacatingDateFrom) {
        query.clientVacatingDate.$gte = req.query.clientVacatingDateFrom;
      }

      if (req.query.clientVacatingDateTo) {
        query.clientVacatingDate.$lte = req.query.clientVacatingDateTo;
      }
    }

    // ================= Vacation 1 =================

    if (req.query.vacationStartDate1From || req.query.vacationStartDate1To) {
      query.vacationStartDate1 = {};

      if (req.query.vacationStartDate1From) {
        query.vacationStartDate1.$gte = req.query.vacationStartDate1From;
      }

      if (req.query.vacationStartDate1To) {
        query.vacationStartDate1.$lte = req.query.vacationStartDate1To;
      }
    }

    if (req.query.vacationLastDate1From || req.query.vacationLastDate1To) {
      query.vacationLastDate1 = {};

      if (req.query.vacationLastDate1From) {
        query.vacationLastDate1.$gte = req.query.vacationLastDate1From;
      }

      if (req.query.vacationLastDate1To) {
        query.vacationLastDate1.$lte = req.query.vacationLastDate1To;
      }
    }
    // ================= Client Status =================

    // ================= Client Status =================

    if (req.query.clientStatus) {
      const today = new Date().toISOString().split("T")[0];

      switch (req.query.clientStatus) {
        case "Cancelled":
          query.isBookingCancelled = true;
          break;

        case "Vacated":
          query.isBookingCancelled = false;

          query.clientVacatingDate = {
            $nin: ["", null],
            $lte: today,
          };
          break;

        case "Notice":
          query.isBookingCancelled = false;

          query.noticeStartDate = {
            $nin: ["", null],
          };

          query.$and = [
            {
              $or: [
                { clientVacatingDate: "" },
                { clientVacatingDate: null },
                { clientVacatingDate: { $gt: today } },
              ],
            },
          ];
          break;

        case "Active":
          query.isBookingCancelled = false;

          query.$and = [
            {
              $or: [
                { noticeStartDate: "" },
                { noticeStartDate: null },
                { noticeStartDate: { $exists: false } },
              ],
            },
            {
              $or: [
                { clientVacatingDate: "" },
                { clientVacatingDate: null },
                { clientVacatingDate: { $gt: today } },
              ],
            },
          ];
          break;
      }
    }
    // ================= Vacation 2 =================

    if (req.query.vacationStartDate2From || req.query.vacationStartDate2To) {
      query.vacationStartDate2 = {};

      if (req.query.vacationStartDate2From) {
        query.vacationStartDate2.$gte = req.query.vacationStartDate2From;
      }

      if (req.query.vacationStartDate2To) {
        query.vacationStartDate2.$lte = req.query.vacationStartDate2To;
      }
    }

    if (req.query.vacationLastDate2From || req.query.vacationLastDate2To) {
      query.vacationLastDate2 = {};

      if (req.query.vacationLastDate2From) {
        query.vacationLastDate2.$gte = req.query.vacationLastDate2From;
      }

      if (req.query.vacationLastDate2To) {
        query.vacationLastDate2.$lte = req.query.vacationLastDate2To;
      }
    }
    // ================= Count =================

    const totalRecords = await Client.countDocuments(query);

    // ================= Data =================

    const clients = await Client.find(query)
      .populate("propertyId", "propertyCode propertyName propertyLocation")
      .populate("bedId", "bedCode roomNo bedNo monthlyRent depositAmount")
      .populate("bedHistory.propertyId", "propertyCode propertyName")
      .populate("bedHistory.bedId", "bedCode roomNo bedNo")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // ================= Response =================

    return res.status(200).json({
      success: true,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      hasNextPage: page < Math.ceil(totalRecords / limit),
      hasPrevPage: page > 1,
      count: clients.length,
      data: clients,
    });
  } catch (error) {
    console.error("Get Clients Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================
// GET SINGLE CLIENT
// ======================================

exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate("propertyId")
      .populate("bedId");

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    res.status(200).json({
      success: true,
      data: client,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================
// UPDATE CLIENT
// ======================================

// exports.updateClient = async (req, res) => {
//   try {
//     const client = await Client.findById(req.params.id);

//     if (!client) {
//       return res.status(404).json({
//         success: false,
//         message: "Client not found",
//       });
//     }

//     // Temporary -> Permanent
//     if (
//       client.stayType === "T. Booked" &&
//       req.body.stayType === "P. Booked"
//     ) {
//       // Same booking ka existing permanent client release karo
//       await Client.updateMany(
//         {
//           bookingId: client.bookingId,
//           stayType: "P. Booked",
//           isBookingCancelled: false,
//           _id: { $ne: client._id },
//         },
//         {
//           $set: {
//             isBookingCancelled: true,
//           },
//         }
//       );

//       // Notice fields clear karo
//       req.body.noticeStartDate = null;
//       req.body.noticeLastDate = null;
//       req.body.clientVacatedDate = null;
//     }

//     // Simple Update
//     Object.keys(req.body).forEach((key) => {
//       client[key] = req.body[key];
//     });

//     await client.save();

//     return res.status(200).json({
//       success: true,
//       message: "Client updated successfully",
//       data: client,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };



exports.updateClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).populate("propertyId", "propertyCode")
      .populate("bedId", "roomNo bedNo");;

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Old Values
    const oldData = {
      clientDoj: client.clientDoj,
      noticeLastDate: client.noticeLastDate,
      clientVacatingDate: client.clientVacatingDate,
      bedId: client.bedId?.toString(),
      monthlyRent: client.monthlyRent,
      depositAmount: client.depositAmount,
      stayType: client.stayType,
    };

    // Temporary -> Permanent
    // Temporary -> Permanent
    if (
      client.stayType === "T. Booked" &&
      req.body.stayType === "P. Booked"
    ) {
      // Cancel future permanent booking
      await Client.updateMany(
        {
          bookingId: client.bookingId,
          stayType: "P. Booked",
          isBookingCancelled: false,
          _id: { $ne: client._id },
        },
        {
          $set: {
            isBookingCancelled: true,
          },
        }
      );

      req.body.noticeStartDate = null;
      req.body.noticeLastDate = null;
      req.body.clientVacatingDate = null;
    }

    // Permanent -> Temporary
    if (
      client.stayType === "P. Booked" &&
      req.body.stayType === "T. Booked"
    ) {
      // Re-activate the cancelled permanent booking
      await Client.updateMany(
        {
          bookingId: client.bookingId,
          stayType: "P. Booked", // <-- yahi change hai
          isBookingCancelled: true,
          _id: { $ne: client._id },
        },
        {
          $set: {
            isBookingCancelled: false,
          },
        }
      );
    }
    // ================= FILE UPLOAD =================

    const getFiles = (key) => req.files?.[key] || [];
    const existingPhoto = req.body.photoExisting
      ? (Array.isArray(req.body.photoExisting)
        ? req.body.photoExisting
        : [req.body.photoExisting])
      : [];

    const existingAadhaarCard = req.body.aadhaarCardExisting
      ? (Array.isArray(req.body.aadhaarCardExisting)
        ? req.body.aadhaarCardExisting
        : [req.body.aadhaarCardExisting])
      : [];

    const existingPan = req.body.panExisting
      ? (Array.isArray(req.body.panExisting)
        ? req.body.panExisting
        : [req.body.panExisting])
      : [];

    const existingCollegeIdentification = req.body.collegeIdentificationExisting
      ? (Array.isArray(req.body.collegeIdentificationExisting)
        ? req.body.collegeIdentificationExisting
        : [req.body.collegeIdentificationExisting])
      : [];

    const existingCompanyIdentification = req.body.companyIdentificationExisting
      ? (Array.isArray(req.body.companyIdentificationExisting)
        ? req.body.companyIdentificationExisting
        : [req.body.companyIdentificationExisting])
      : [];

    const existingClientRentalAgreement = req.body.clientRentalAgreementExisting
      ? (Array.isArray(req.body.clientRentalAgreementExisting)
        ? req.body.clientRentalAgreementExisting
        : [req.body.clientRentalAgreementExisting])
      : [];

    const existingClientPoliceNOC = req.body.clientPoliceNOCExisting
      ? (Array.isArray(req.body.clientPoliceNOCExisting)
        ? req.body.clientPoliceNOCExisting
        : [req.body.clientPoliceNOCExisting])
      : [];

    // PHOTO
    if (getFiles("photo").length > 0) {
      const uploads = await Promise.all(
        getFiles("photo").map((file) =>
          uploadFile(file, `Clients Docs/${client?.propertyId?.propertyCode}/${client?.fullName}`)
        )
      );
      client.photo = [...existingPhoto, ...uploads];
    } else {
      client.photo = existingPhoto;
    }

    // AADHAAR
    if (getFiles("aadhaarCard").length > 0) {
      const uploads = await Promise.all(
        getFiles("aadhaarCard").map((file) =>
          uploadFile(file, `Clients Docs/${client?.propertyId?.propertyCode}/${client?.fullName}`)
        )
      );
      client.aadhaarCard = [...existingAadhaarCard, ...uploads];
    } else {
      client.aadhaarCard = existingAadhaarCard;
    }

    // PAN
    if (getFiles("pan").length > 0) {
      const uploads = await Promise.all(
        getFiles("pan").map((file) =>
          uploadFile(file, `Clients Docs/${client?.propertyId?.propertyCode}/${client?.fullName}`)
        )
      );
      client.pan = [...existingPan, ...uploads];
    } else {
      client.pan = existingPan;
    }

    // COLLEGE ID
    if (getFiles("collegeIdentification").length > 0) {
      const uploads = await Promise.all(
        getFiles("collegeIdentification").map((file) =>
          uploadFile(file, `Clients Docs/${client?.propertyId?.propertyCode}/${client?.fullName}`)
        )
      );
      client.collegeIdentification = [
        ...existingCollegeIdentification,
        ...uploads,
      ];
    } else {
      client.collegeIdentification = existingCollegeIdentification;
    }

    // COMPANY ID
    if (getFiles("companyIdentification").length > 0) {
      const uploads = await Promise.all(
        getFiles("companyIdentification").map((file) =>
          uploadFile(file, `Clients Docs/${client?.propertyId?.propertyCode}/${client?.fullName}`)
        )
      );
      client.companyIdentification = [
        ...existingCompanyIdentification,
        ...uploads,
      ];
    } else {
      client.companyIdentification = existingCompanyIdentification;
    }

    // RENTAL AGREEMENT
    if (getFiles("clientRentalAgreement").length > 0) {
      const uploads = await Promise.all(
        getFiles("clientRentalAgreement").map((file) =>
          uploadFile(file, `Clients Docs/${client?.propertyId?.propertyCode}/${client?.fullName}`)
        )
      );
      client.clientRentalAgreement = [
        ...existingClientRentalAgreement,
        ...uploads,
      ];
    } else {
      client.clientRentalAgreement = existingClientRentalAgreement;
    }

    // POLICE NOC
    if (getFiles("clientPoliceNOC").length > 0) {
      const uploads = await Promise.all(
        getFiles("clientPoliceNOC").map((file) =>
          uploadFile(file, `Clients Docs/${client?.propertyId?.propertyCode}/${client?.fullName}`)
        )
      );
      client.clientPoliceNOC = [
        ...existingClientPoliceNOC,
        ...uploads,
      ];
    } else {
      client.clientPoliceNOC = existingClientPoliceNOC;
    }
    // ===============================================
    const wasBookingCancelled = client.isBookingCancelled;
    // Update Other Fields
    Object.keys(req.body).forEach((key) => {
      if (!key.endsWith("Existing")) {
        client[key] = req.body[key];
      }
    });

    await client.save();

    if (
      wasBookingCancelled !== client.isBookingCancelled
    ) {
      await User.findOneAndUpdate(
        {
          bookingId: client.bookingId,
          role: "Client",
        },
        {
          $set: {
            isActive: !client.isBookingCancelled,
          },
        }
      );
    }
    await client.save();
    const shouldRecalculate =
      oldData.clientDoj !== client.clientDoj ||
      oldData.noticeLastDate !== client.noticeLastDate ||
      oldData.clientVacatingDate !== client.clientVacatingDate ||
      oldData.bedId !== client.bedId?.toString() ||
      oldData.monthlyRent !== client.monthlyRent ||
      oldData.depositAmount !== client.depositAmount;

    const isTempToPermanent =
      oldData.stayType === "T. Booked" &&
      req.body.stayType === "P. Booked";

    if (shouldRecalculate) {
      await recalculateRentHistory(client._id, isTempToPermanent);
    }

    return res.status(200).json({
      success: true,
      message: "Client updated successfully",
      data: client,
    });
  } catch (error) {
    console.error("Update Client Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// exports.updateClient = async (req, res) => {

//   try {
//     const client = await Client.findById(req.params.id);

//     if (!client) {
//       return res.status(404).json({
//         success: false,
//         message: "Client not found",
//       });
//     }

//     // Old Values
//     const oldData = {
//       clientDoj: client.clientDoj,
//       noticeLastDate: client.noticeLastDate,
//       clientVacatingDate: client.clientVacatingDate,
//       bedId: client.bedId?.toString(),
//       monthlyRent: client.monthlyRent,
//       depositAmount: client.depositAmount,
//       stayType: client.stayType,
//     };

//     // Temporary -> Permanent
//     if (
//       client.stayType === "T. Booked" &&
//       req.body.stayType === "P. Booked"
//     ) {
//       await Client.updateMany(
//         {
//           bookingId: client.bookingId,
//           stayType: "P. Booked",
//           isBookingCancelled: false,
//           _id: { $ne: client._id },
//         },
//         {
//           $set: {
//             isBookingCancelled: true,
//           },
//         }
//       );

//       req.body.noticeStartDate = null;
//       req.body.noticeLastDate = null;
//       req.body.clientVacatedDate = null;
//     }

//     // Update Client
//     Object.keys(req.body).forEach((key) => {
//       client[key] = req.body[key];
//     });

//     await client.save();

//     // Check if Rent History Recalculation Needed
//     const shouldRecalculate =
//       oldData.clientDoj !== client.clientDoj||
//       oldData.noticeLastDate !== client.noticeLastDate ||
//       oldData.clientVacatingDate !== client.clientVacatingDate ||
//       oldData.bedId !== client.bedId?.toString() ||
//       oldData.monthlyRent !== client.monthlyRent ||
//       oldData.depositAmount !== client.depositAmount;

//     if (shouldRecalculate) {
//       await recalculateRentHistory(client._id);
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Client updated successfully",
//       data: client,
//     });
//   } catch (error) {
//     console.error("Update Client Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


// ======================================
// DELETE CLIENT
// ======================================

exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    await client.deleteOne();

    res.status(200).json({
      success: true,
      message: "Client deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.getNoticeClients = async (req, res) => {
  try {
    const clients = await Client.aggregate([
      {
        $match: {
          isBookingCancelled: false,
          noticeLastDate: {
            $exists: true,
            $nin: [null, ""],
          },
        },
      },

      {
        $lookup: {
          from: "clientrenthistories",
          let: {
            clientId: "$_id",
          },

          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$clientId", "$$clientId"],
                },
              },
            },
            {
              $sort: {
                year: -1,
                month: -1,
                createdAt: -1,
                _id: -1,
              },
            },
            {
              $limit: 1,
            },
          ],

          as: "latestRentHistory",
        },
      },
// ==========================================
// TOTAL PAID DEPOSIT
// ==========================================
{
  $lookup: {
    from: "clientrenthistories",
    let: {
      clientId: "$_id",
    },
    pipeline: [
      {
        $match: {
          $expr: {
            $eq: ["$clientId", "$$clientId"],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalPaidDeposit: {
            $sum: {
              $toDouble: {
                $ifNull: [
                  "$depositAmount",
                  0,
                ],
              },
            },
          },
        },
      },
    ],
    as: "depositSummary",
  },
},
      {
        $unwind: {
          path: "$latestRentHistory",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: "properties",
          localField: "propertyId",
          foreignField: "_id",
          as: "property",
        },
      },

      {
        $unwind: {
          path: "$property",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: "beds",
          localField: "bedId",
          foreignField: "_id",
          as: "bed",
        },
      },

      {
        $unwind: {
          path: "$bed",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          _id: 1,
          fullName: 1,
          emailId: 1,
          callingNo: 1,
          whatsappNo: 1,

          clientDoj: 1,
          noticeStartDate: 1,
          noticeLastDate: 1,
          clientVacatingDate: 1,

          stayType: 1,
          status: 1,
          isBookingCancelled: 1,
totalPaidDeposit: {
  $ifNull: [
    {
      $arrayElemAt: [
        "$depositSummary.totalPaidDeposit",
        0,
      ],
    },
    0,
  ],
},
          propertyId: 1,
          propertyCode: "$property.propertyCode",

          bedId: 1,
          roomNo: "$bed.roomNo",
          bedNo: "$bed.bedNo",

          latestRentHistory: 1,
        },
      },

      {
        $sort: {
          noticeLastDate: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      count: clients.length,
      data: clients,
    });
  } catch (error) {
    console.error("Get Notice Clients Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getClientsWithLatestRentHistory = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const clients = await Client.aggregate([
      {
        $match: {
          isBookingCancelled: false,
        },
      },

      {
        $lookup: {
          from: "properties",
          localField: "propertyId",
          foreignField: "_id",
          as: "property",
        },
      },

      {
        $unwind: {
          path: "$property",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: "beds",
          localField: "bedId",
          foreignField: "_id",
          as: "bed",
        },
      },

      {
        $unwind: {
          path: "$bed",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: "rentnotreceivedcomments",
          localField: "_id",
          foreignField: "clientId",
          as: "rentNotReceivedComment",
        },
      },

      {
        $lookup: {
          from: "clientrenthistories",
          let: {
            clientId: "$_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$clientId", "$$clientId"],
                },
              },
            },

            {
              $sort: {
                year: -1,
                month: -1,
                createdAt: -1,
                _id: -1,
              },
            },

            {
              $limit: 1,
            },

            {
              $match: {
                $expr: {
                  $gt: [
                    {
                      $ifNull: ["$currentDue", 0],
                    },
                    0,
                  ],
                },
              },
            },
          ],
          as: "latestRentHistory",
        },
      },

      {
        $unwind: {
          path: "$latestRentHistory",
          preserveNullAndEmptyArrays: false,
        },
      },

      {
        $project: {
          _id: 1,

          fullName: 1,
          emailId: 1,
          callingNo: 1,
          whatsappNo: 1,

          propertyId: 1,

          propertyCode: "$property.propertyCode",

          bedId: "$bed._id",
          roomNo: "$bed.roomNo",
          bedNo: "$bed.bedNo",

          stayType: 1,

          clientDoj: 1,
          noticeStartDate: 1,
          noticeLastDate: 1,
          clientVacatingDate: 1,

          monthlyRent: 1,
          depositAmount: 1,

          rentNotReceivedComment: {
            $ifNull: [
              {
                $arrayElemAt: [
                  "$rentNotReceivedComment",
                  0,
                ],
              },
              {
                _id: null,
                comments: [],
              },
            ],
          },

          latestRentHistory: {
            _id: "$latestRentHistory._id",

            month: "$latestRentHistory.month",
            monthName: "$latestRentHistory.monthName",
            year: "$latestRentHistory.year",

            startDate: "$latestRentHistory.startDate",
            endDate: "$latestRentHistory.endDate",

            monthlyRent:
              "$latestRentHistory.monthlyRent",

            daysCount:
              "$latestRentHistory.daysCount",

            rentDivider:
              "$latestRentHistory.rentDivider",

            totalRent:
              "$latestRentHistory.totalRent",

            totalReceived:
              "$latestRentHistory.totalReceived",

            currentDue: {
              $ifNull: [
                "$latestRentHistory.currentDue",
                0,
              ],
            },

            paymentStatus:
              "$latestRentHistory.paymentStatus",

            ebAmt:
              "$latestRentHistory.ebAmt",

            flatEB:
              "$latestRentHistory.flatEB",

            adjEB:
              "$latestRentHistory.adjEB",

            adjAmt:
              "$latestRentHistory.adjAmt",

            processingFees:
              "$latestRentHistory.processingFees",

            parkingCharges:
              "$latestRentHistory.parkingCharges",

            depositAmount:
              "$latestRentHistory.depositAmount",

            depositAmountReceived:
              "$latestRentHistory.depositAmountReceived",
          },
        },
      },

      {
        $sort: {
          fullName: 1,
          _id: 1,
        },
      },

      // PAGINATION
      {
        $facet: {
          data: [
            {
              $skip: skip,
            },
            {
              $limit: limit,
            },
          ],

          totalCount: [
            {
              $count: "count",
            },
          ],

          totalCurrentDue: [
            {
              $group: {
                _id: null,
                total: {
                  $sum: {
                    $toDouble: {
                      $ifNull: [
                        "$latestRentHistory.currentDue",
                        0,
                      ],
                    },
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    const result = clients[0] || {};

    const data = result.data || [];

    const totalCount =
      result.totalCount?.[0]?.count || 0;

    const totalCurrentDue =
      result.totalCurrentDue?.[0]?.total || 0;

    const totalPages = Math.ceil(
      totalCount / limit
    );

    return res.status(200).json({
      success: true,

      count: data.length,

      totalCount,

      totalPages,

      currentPage: page,

      limit,

      hasNextPage: page < totalPages,

      hasPreviousPage: page > 1,

      totalCurrentDue,

      data,
    });
  } catch (error) {
    console.error(
      "Get Clients With Latest Rent History Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// exports.getClientsWithLatestRentHistory = async (req, res) => {
//   try {



//     const clients = await Client.aggregate([
//       {
//         $match: {
//           isBookingCancelled: false,
//         },
//       },

//       {
//         $lookup: {
//           from: "properties",
//           localField: "propertyId",
//           foreignField: "_id",
//           as: "property",
//         },
//       },

//       {
//         $unwind: {
//           path: "$property",
//           preserveNullAndEmptyArrays: true,
//         },
//       },

//       {
//         $lookup: {
//           from: "beds",
//           localField: "bedId",
//           foreignField: "_id",
//           as: "bed",
//         },
//       },

//       {
//         $unwind: {
//           path: "$bed",
//           preserveNullAndEmptyArrays: true,
//         },
//       },
//       {
//         $lookup: {
//           from: "rentnotreceivedcomments",
//           localField: "_id",
//           foreignField: "clientId",
//           as: "rentNotReceivedComment",
//         },
//       },

//       {
//         $lookup: {
//           from: "clientrenthistories",
//           let: {
//             clientId: "$_id",
//           },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $eq: ["$clientId", "$$clientId"],
//                 },
//               },
//             },

//             {
//               $sort: {
//                 year: -1,
//                 month: -1,
//                 createdAt: -1,
//                 _id: -1,
//               },
//             },

//             {
//               $limit: 1,
//             },

//             {
//               $match: {
//                 $expr: {
//                   $gt: [
//                     {
//                       $ifNull: ["$currentDue", 0],
//                     },
//                     0,
//                   ],
//                 },
//               },
//             },
//           ],
//           as: "latestRentHistory",
//         },
//       },

//       {
//         $unwind: {
//           path: "$latestRentHistory",
//           preserveNullAndEmptyArrays: false,
//         },
//       },

//       {
//         $project: {
//           _id: 1,

//           fullName: 1,
//           emailId: 1,
//           callingNo: 1,
//           whatsappNo: 1,

//           propertyId: 1,

//           propertyCode: "$property.propertyCode",

//           bedId: "$bed._id",
//           roomNo: "$bed.roomNo",
//           bedNo: "$bed.bedNo",

//           stayType: 1,

//           clientDoj: 1,
//           noticeStartDate: 1,
//           noticeLastDate: 1,
//           clientVacatingDate: 1,

//           monthlyRent: 1,
//           depositAmount: 1,
//           rentNotReceivedComment: {
//               $ifNull: [
//                 {
//                   $arrayElemAt: [
//                     "$rentNotReceivedComment",
//                     0,
//                   ],
//                 },
//                 {
//                   _id: null,
//                   comments: [],
//                 },
//               ],
//             },
//           latestRentHistory: {
//             _id: "$latestRentHistory._id",

//             month: "$latestRentHistory.month",
//             monthName: "$latestRentHistory.monthName",
//             year: "$latestRentHistory.year",

//             startDate: "$latestRentHistory.startDate",
//             endDate: "$latestRentHistory.endDate",

//             monthlyRent:
//               "$latestRentHistory.monthlyRent",

//             daysCount:
//               "$latestRentHistory.daysCount",

//             rentDivider:
//               "$latestRentHistory.rentDivider",

//             totalRent:
//               "$latestRentHistory.totalRent",

//             totalReceived:
//               "$latestRentHistory.totalReceived",

//             currentDue: {
//               $ifNull: [
//                 "$latestRentHistory.currentDue",
//                 0,
//               ],
//             },
  

//             paymentStatus:
//               "$latestRentHistory.paymentStatus",

//             ebAmt:
//               "$latestRentHistory.ebAmt",

//             flatEB:
//               "$latestRentHistory.flatEB",

//             adjEB:
//               "$latestRentHistory.adjEB",

//             adjAmt:
//               "$latestRentHistory.adjAmt",

//             processingFees:
//               "$latestRentHistory.processingFees",

//             parkingCharges:
//               "$latestRentHistory.parkingCharges",

//             depositAmount:
//               "$latestRentHistory.depositAmount",

//             depositAmountReceived:
//               "$latestRentHistory.depositAmountReceived",
//           },
//         },
//       },

//       {
//         $sort: {
//           fullName: 1,
//         },
//       },
//     ]);

//     const totalCurrentDue = clients.reduce(
//       (total, client) =>
//         total +
//         Number(
//           client.latestRentHistory?.currentDue || 0
//         ),
//       0
//     );

//     return res.status(200).json({
//       success: true,
//       count: clients.length,
//       totalCurrentDue,
//       data: clients,
//     });
//   } catch (error) {
//     console.error(
//       "Get Clients With Latest Rent History Error:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };