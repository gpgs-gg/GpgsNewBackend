
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



exports.createDummyClients = async (req, res) => {
  try {
    const clients = [];

    for (let i = 1; i <= 2000; i++) {
      clients.push({
        propertyId: "6a40c37f1b3149860bf45ae6",
        bedId: "6a40c54d1b3149860bf45ae7",
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

    // =========================
    // REACTIVATE OLD CLIENTS
    // =========================

    const existingClients =
      await Client.find({
        bookingId,
      });

    if (existingClients.length > 0) {
      await Client.updateMany(
        { bookingId },
        {
          $set: {
            loginEnabled: true,
            isBookingCancelled: false,
          },
        }
      );
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
        message:
          "Existing clients reactivated successfully",
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
    const clients = await Client.find()
      .populate(
        "propertyId",
        "propertyCode propertyName"
      )
      .populate(
        "bedId",
        "bedCode roomNo bedNo monthlyRent depositAmount"
      )
      .populate(
        "bedHistory.propertyId",
        "propertyCode propertyName"
      )
      .populate(
        "bedHistory.bedId",
        "bedCode roomNo bedNo"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients,
    });
  } catch (error) {
    res.status(500).json({
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

    // Update Other Fields
    Object.keys(req.body).forEach((key) => {
      if (!key.endsWith("Existing")) {
        client[key] = req.body[key];
      }
    });

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

// ======================================
// AVAILABLE BEDS
// ======================================
