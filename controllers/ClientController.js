
const Client = require("../models/client.model");
const Bed = require("../models/bed.model");
const Property = require("../models/property.model");
const Booking = require("../models/newBooking.model");
const { recalculateRentHistory } = require("../services/rentHistory.service");

const {
  createClientRentHistory,
} = require("../services/rentHistory.service");

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
            isBookingCancelled: false,
          },
        }
      );

      booking.status = "Booked";
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
      booking.status === "Booked" &&
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
        bookingId: booking._id,

        fullName: booking.fullName,
        emailId: booking.emailId,
        callingNo: booking.callingNo,
        whatsappNo: booking.whatsappNo,

        propertyId: booking.propertyId,
        bedId: booking.bedId,
         processingFees : booking.processingFees,
         parkingCharges : booking.parkingCharges,
        monthlyRent:
          booking.monthlyRent,

        depositAmount:
          booking.depositAmount,

        clientDoj:
          booking.clientDoj,
          
        stayType: "P. Booked",

        comments: booking.comments,

        status: "Booked",

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
        bookingId: booking._id,

        fullName: booking.fullName,
        emailId: booking.emailId,
        callingNo: booking.callingNo,
        whatsappNo: booking.whatsappNo,

        propertyId:
          booking.temporaryPropertyId,

        bedId:
          booking.temporaryBedId,

        monthlyRent:
          booking.temporaryMonthlyRent,

        clientDoj:
          booking.temporaryClientDoj,

        clientVacatingDate:
          booking.temporaryClientLastDate,
        stayType: "T. Booked",
        noticeStartDate: booking.temporaryClientDoj,
        noticeLastDate: booking.temporaryClientLastDate,
        comments:
          booking.temporaryComments,

        status: "Booked",

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

    booking.status = "Booked";
    booking.isCancelled = false;
    booking.cancelledDate = null;

    await booking.save();

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
    const client = await Client.findById(req.params.id);

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
    if (
      client.stayType === "T. Booked" &&
      req.body.stayType === "P. Booked"
    ) {
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
      req.body.clientVacatedDate = null;
    }

    // Update Client
    Object.keys(req.body).forEach((key) => {
      client[key] = req.body[key];
    });

    await client.save();

    // Check if Rent History Recalculation Needed
    const shouldRecalculate =
      oldData.clientDoj !== client.clientDoj||
      oldData.noticeLastDate !== client.noticeLastDate ||
      oldData.clientVacatingDate !== client.clientVacatingDate ||
      oldData.bedId !== client.bedId?.toString() ||
      oldData.monthlyRent !== client.monthlyRent ||
      oldData.depositAmount !== client.depositAmount;
      
    if (shouldRecalculate) {
      await recalculateRentHistory(client._id);
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
