const ClientRentHistory = require("../models/clientRentHistory.model");
const Client = require("../models/client.model");
const Property = require("../models/property.model");
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
    const { clientId, propertyId, month, year, search } = req.query;

    const filter = {};

    // Direct filters
    if (clientId) filter.clientId = clientId;
    if (propertyId) filter.propertyId = propertyId;
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);

    // Search filter
    if (search?.trim()) {
      const keyword = search.trim();

      const [clients, properties, beds] = await Promise.all([
        Client.find({
          $or: [
            { fullName: { $regex: keyword, $options: "i" } },
            { callingNo: { $regex: keyword, $options: "i" } },
          ],
        }).select("_id"),

        Property.find({
          propertyCode: { $regex: keyword, $options: "i" },
        }).select("_id"),

        Bed.find({
          $or: [
            { roomNo: { $regex: keyword, $options: "i" } },
            { bedNo: { $regex: keyword, $options: "i" } },
          ],
        }).select("_id"),
      ]);

      const searchConditions = [
        { clientId: { $in: clients.map((item) => item._id) } },
        { propertyId: { $in: properties.map((item) => item._id) } },
        { bedId: { $in: beds.map((item) => item._id) } },
        { monthName: { $regex: keyword, $options: "i" } },
        { paymentStatus: { $regex: keyword, $options: "i" } },
        { paymentComments: { $regex: keyword, $options: "i" } },
        { remarks: { $regex: keyword, $options: "i" } },
      ];

      // Numeric search
      if (!isNaN(keyword)) {
        const number = Number(keyword);

        searchConditions.push(
          { year: number },
          { month: number },
          { currentDue: number },
          { totalReceived: number },
          { totalReceivable: number },
          { monthlyRent: number }
        );
      }

      filter.$or = searchConditions;
    }

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

    return res.status(200).json({
      success: true,
      count: rentHistory.length,
      data: rentHistory,
    });
  } catch (error) {
    console.error("getClientRentHistory error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch client rent history.",
      error: error.message,
    });
  }
};


exports.getClientRentHistoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const history = await ClientRentHistory.findById(id)
      .populate("clientId", "fullName callingNo clientDoj")
      .populate("propertyId", "propertyCode")
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

exports.getClientRentHistoryByBookingId = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Booking ke sabhi clients
    const clients = await Client.find({ bookingId }).select("_id");

    if (!clients.length) {
      return res.status(404).json({
        success: false,
        message: "No clients found for this booking.",
      });
    }

    const clientIds = clients.map((c) => c._id);

    // Sabhi rent history
    const histories = await ClientRentHistory.find({
      clientId: { $in: clientIds },
    })
      .populate("clientId", "fullName callingNo clientDoj stayType")
      .populate("propertyId", "propertyCode")
      .populate("bedId", "bedNo roomNo")
      .sort({
        year: -1,
        month: -1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: histories.length,
      data: histories,
    });
  } catch (error) {
    console.error(
      "Get Rent History By BookingId Error:",
      error
    );

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
      processingFees = 0,
      parkingCharges = 0,
      depositAmount = 0,
      totalReceived = 0,
      monthlyRent = 0,
      paymentComments = "",
      remarks = "",
    } = req.body;

    const history = await ClientRentHistory.findById(id);
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

   
  const daysCount = history.daysCount;

    const receivedAmount = Number(totalReceived || 0);
    const cumulativeReceived =
      (history.totalReceived || 0) + receivedAmount;
    // Recalculate Complete Rent


const actualLastDay = new Date(
  history.year,
  history.month,
  0
).getDate();

const rentDivider =
  actualLastDay === 31 ? 30 : actualLastDay;


    const calculation = calculateRentHistory({
      // monthlyRent: history.monthlyRent,
      // depositAmount: history.depositAmount,

      monthlyRent: Number(monthlyRent),

      depositAmount: Number(depositAmount),

      daysCount,

      previousDue: history.previousDue,

      ebAmt: Number(ebAmt),

      flatEB: Number(flatEB),

      adjEB: Number(adjEB),

      adjAmt: Number(adjAmt),

      processingFees: history.processingFees,

      processingFees: Number(processingFees),
      parkingCharges: Number(parkingCharges),
      depositAmount: Number(depositAmount),

      rentReceived: cumulativeReceived,
       rentDivider,
    });
    Object.assign(history, calculation);
    if (!isNaN(receivedAmount) && receivedAmount !== 0) {
      history.totalReceivedHistory.push({
        amount: receivedAmount,
        date: new Date(),
      });
    }
    history.daysCount = daysCount;
    // Snapshot bhi update kar do
    history.clientDoj = client.clientDoj;
    history.noticeLastDate = client.noticeLastDate;

    history.paymentComments = paymentComments;
    history.remarks = remarks;

    await history.save();
await history.save();

const futureHistories = await ClientRentHistory.find({
  clientId: history.clientId,
  $or: [
    { year: { $gt: history.year } },
    {
      year: history.year,
      month: { $gt: history.month },
    },
  ],
}).sort({
  year: 1,
  month: 1,
  createdAt: 1,
});

let previousDue = Number(history.currentDue || 0);

for (const futureHistory of futureHistories) {
  const actualLastDay = new Date(
    futureHistory.year,
    futureHistory.month,
    0
  ).getDate();

  const rentDivider =
    actualLastDay === 31 ? 30 : actualLastDay;

  const futureCalculation = calculateRentHistory({
    monthlyRent: Number(futureHistory.monthlyRent || 0),
    depositAmount: Number(futureHistory.depositAmount || 0),

    daysCount: Number(futureHistory.daysCount || 0),

    previousDue,

    ebAmt: Number(futureHistory.ebAmt || 0),
    flatEB: Number(futureHistory.flatEB || 0),
    adjEB: Number(futureHistory.adjEB || 0),
    adjAmt: Number(futureHistory.adjAmt || 0),

    processingFees: Number(
      futureHistory.processingFees || 0
    ),

    parkingCharges: Number(
      futureHistory.parkingCharges || 0
    ),

    processingFeesReceived: Number(
      futureHistory.processingFeesReceived || 0
    ),

    depositAmountReceived: Number(
      futureHistory.depositAmountReceived || 0
    ),

    rentReceived: Number(
      futureHistory.totalReceived || 0
    ),

    rentDivider,
  });

  Object.assign(futureHistory, futureCalculation);

  futureHistory.previousDue = previousDue;

  await futureHistory.save();

  previousDue = Number(
    futureHistory.currentDue || 0
  );
}
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