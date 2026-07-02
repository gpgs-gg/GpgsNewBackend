const ClientRentHistory = require("../models/clientRentHistory.model");
const Client = require("../models/client.model");
const Bed = require("../models/bed.model");
const calculateRentHistory = require("../utils/calculateRentHistory");
const getDaysCount = require("../utils/getDaysCount");




// exports.getClientCompleteRentHistory = async (req, res) => {
//   try {
//     const { clientId } = req.params;

//     const history = await ClientRentHistory.find({
//       clientId,
//     })
//       .populate("clientId", "fullName callingNo")
//       .populate("propertyId", "propertyName")
//       .populate("bedId", "bedNo roomNo monthlyRent")
//       .sort({
//         year: 1,
//         month: 1,
//       });

//     if (!history.length) {
//       return res.status(404).json({
//         success: false,
//         message: "No rent history found.",
//       });
//     }
  
//     return res.status(200).json({
//       success: true,
//       totalRecords: history.length,
//       data: history,
//     });
//   } catch (error) {
//     console.error("Get Client Rent History Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


exports.getClientRentHistory = async (req, res) => {
  try {
    console.time("RentHistory");

    const { clientId, month, year } = req.query;

    const filter = {};
    if (clientId) filter.clientId = clientId;
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);

    console.time("Mongo Query");

    const rentHistory = await ClientRentHistory.find(filter)
      .populate("clientId", "fullName callingNo clientDoj")
      .populate("propertyId", "propertyCode")
      .populate("bedId", "bedNo roomNo")  
      .sort({
        year: -1,
        month: -1,
        createdAt: -1,
      })
      .lean();

    console.timeEnd("Mongo Query");

    console.timeEnd("RentHistory");

    return res.status(200).json({
      success: true,
      count: rentHistory.length,
      data: rentHistory,
    });
  } catch (error) {
    console.error(error);
  }
};


exports.getClientRentHistoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const history = await ClientRentHistory.findById(id)
      .populate("clientId", "clientName mobileNo")
      .populate("propertyId", "propertyName")
      .populate("bedId", "bedNo roomNo");

    if (!history) {
      return res.status(404).json({
        success: false,
        message: "Rent history not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Get Rent History By Id Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




exports.createClientRentHistory = async (client) => {
  try {
    // Bed Details
    const bed = await Bed.findById(client.bedId).lean();

    if (!bed) {
      throw new Error("Bed not found.");
    }

    // Duplicate Check
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const alreadyExists = await ClientRentHistory.findOne({
      clientId: client._id,
      month,
      year,
    });

    if (alreadyExists) {
      return alreadyExists;
    }

    // Previous Due
    const lastHistory = await ClientRentHistory.findOne({
      clientId: client._id,
    }).sort({
      year: -1,
      month: -1,
      createdAt: -1,
    });

    const previousDue = lastHistory?.currentDue || 0;

    // Charges
    const rentAmt = Number(bed.monthlyRent || 0);
    const ebAmt = 0;
    const flatEB = 0;
    const adjEB = 0;
    const adjAmt = 0;
    const processingFees = 0;

    // Final Calculation
    const totalReceivable =
      previousDue +
      rentAmt +
      ebAmt +
      flatEB +
      processingFees -
      adjAmt -
      adjEB;

    const totalReceived = 0;

    const currentDue =
      totalReceivable - totalReceived;

    const paymentStatus =
      currentDue <= 0
        ? "Paid"
        : "Pending";

    // Create History
    const history =
      await ClientRentHistory.create({
        clientId: client._id,

        bookingId: client.bookingId || null,

        propertyId: client.propertyId,

        bedId: client.bedId,

        stayType: client.stayType,

        month,

        year,

        monthName: new Date().toLocaleString(
          "default",
          {
            month: "long",
          }
        ),

        rentAmt,

        ebAmt,

        flatEB,

        adjEB,

        adjAmt,

        processingFees,

        previousDue,

        totalReceivable,

        totalReceived,

        currentDue,

        paymentStatus,

        paymentComments: "",

        remarks: "",
      });

    return history;
  } catch (err) {
    console.error(
      "Create Rent History Error:",
      err
    );

    throw err;
  }
};

exports.updateClientRentHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      ebAmt = 0,
      flatEB = 0,
      adjEB = 0,
      adjAmt = 0,

      processingFeesReceived = 0,
      depositAmountReceived = 0,

      totalReceived = 0,

      paymentComments = "",
      remarks = "",
    } = req.body;

    const history = await ClientRentHistory.findById(id);
       console.log(history)
    if (!history) {
      return res.status(404).json({
        success: false,
        message: "Rent history not found",
      });
    }

    // Latest Client Data
    const client = await Client.findById(history.clientId)
      .select("clientDoj noticeLastDate")
      .lean();

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Recalculate Days
    const daysCount = getDaysCount(
      client.clientDoj,
      client.noticeLastDate,
      history.month,
      history.year
    );

     console.log(1212121, daysCount, client.clientDoj,
      client.noticeLastDate,
      history.month,
      history.year)


    // Recalculate Complete Rent
    const calculation = calculateRentHistory({
      monthlyRent: history.monthlyRent,

      depositAmount: history.depositAmount,

      daysCount,

      previousDue: history.previousDue,

      ebAmt: Number(ebAmt),

      flatEB: Number(flatEB),

      adjEB: Number(adjEB),

      adjAmt: Number(adjAmt),

      processingFees: history.processingFees,

      processingFeesReceived: Number(processingFeesReceived),

      depositAmountReceived: Number(depositAmountReceived),

      rentReceived: Number(totalReceived),
    });

    Object.assign(history, calculation);

    history.daysCount = daysCount;

    // Snapshot bhi update kar do
    history.clientDoj = client.clientDoj;
    history.noticeLastDate = client.noticeLastDate;

    history.paymentComments = paymentComments;
    history.remarks = remarks;

    await history.save();

    return res.status(200).json({
      success: true,
      message: "Rent history updated successfully",
      data: history,
    });
  } catch (error) {
    console.error("Update Rent History Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};