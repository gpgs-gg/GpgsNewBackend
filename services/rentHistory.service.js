const Client = require("../models/client.model");
const ClientRentHistory = require("../models/clientRentHistory.model");
const Bed = require("../models/bed.model");
const calculateRentHistory = require("../utils/calculateRentHistory");
const batchInsert = require("../utils/batchInsert");
const getDaysCount = require("../utils/getDaysCount");

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];



const createClientRentHistory = async (client) => {

  try {
    // Bed Details
    const bed = await Bed.findById(client.bedId).lean();

    if (!bed) {
      throw new Error("Bed not found.");
    }

    const doj = new Date(client.clientDoj);

    const month = doj.getMonth() + 1; // 1-12
    const year = doj.getFullYear();

    // Current Month History
    let history = await ClientRentHistory.findOne({
      clientId: client._id,
      stayType: client.stayType,
      month,
      year,
    });
    // Previous Due
    let previousDue;

    if (history) {
      // UPDATE
      previousDue = history.previousDue;
    } else {
      // CREATE
      const lastHistory = await ClientRentHistory.findOne({
        clientId: client._id,
      }).sort({
        year: -1,
        month: -1,
        createdAt: -1,
      });

      previousDue = lastHistory?.currentDue || 0;
    }

    const monthlyRent = Number(
      bed.monthlyRent || 0
    );

    let depositAmount = 0;

    if (client.stayType === "P. Booked") {
      depositAmount = Number(bed.depositAmount || 0);
    }

    const processingFees = Number(
      client.processingFees || 0
    );

    const parkingCharges = Number(
      client.stayType === "T. Booked"
        ? client.temporaryParkingCharges || 0
        : client.parkingCharges || 0
    );

    let rentReceived = 0;
    if (client.stayType === "P. Booked") {
      rentReceived = Number(client.bookingAmount || 0) - Number(client.temporaryTotalAmount || 0);
    } else if (client.stayType === "T. Booked") {
      rentReceived = Number(client.temporaryTotalAmount || 0);
      // rentReceived = 0;
    }



    const noticeLastDate = client.noticeLastDate
      ? new Date(client.noticeLastDate)
      : null;
    // Business rule: month ka end (31 ko 30 treat karna)
    const lastDay = new Date(year, month, 0).getDate();

    const monthEndDate = new Date(
      year,
      month - 1,
      lastDay === 31 ? 30 : lastDay
    );

    let endDate;

    if (noticeLastDate) {
      endDate =
        noticeLastDate > monthEndDate
          ? monthEndDate
          : noticeLastDate;
    } else {
      endDate = monthEndDate;
    }

    const daysCount = getDaysCount(
      client.clientDoj,
      endDate,
      month,
      year
    );

    const calculation =
      calculateRentHistory({
        monthlyRent,
        depositAmount,
        daysCount,
        previousDue,
        ebAmt: 0,
        flatEB: 0,
        adjEB: 0,
        adjAmt: 0,
        processingFees,
        parkingCharges,
        processingFeesReceived: 0,
        depositAmountReceived: 0,
        rentReceived,
      });

    if (history) {
      Object.assign(history, {
        bookingId: client.bookingId || null,
        propertyId: client.propertyId,
        bedId: client.bedId,
        stayType: client.stayType,
        startDate: client.clientDoj,
        endDate,
        monthName: doj.toLocaleString("default", {
          month: "long",
        }),
        ...calculation,
      });

      await history.save();
      return history;
    }

    // Create New
    history = await ClientRentHistory.create({
      clientId: client._id,
      bookingId: client.bookingId || null,
      propertyId: client.propertyId,
      bedId: client.bedId,
      stayType: client.stayType,
      month,
      year,
      startDate: client.clientDoj,
      endDate,
      monthName: doj.toLocaleString("default", {
        month: "long",
      }),
      ...calculation,
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


// const createClientRentHistory = async (client) => {
//   try {
//     // Bed Details
//     const bed = await Bed.findById(client.bedId).lean();

//     if (!bed) {
//       throw new Error("Bed not found.");
//     }

//     const doj = new Date(client.clientDoj);

//     const month = doj.getMonth() + 1; // 1-12
//     const year = doj.getFullYear();

//     // Duplicate Check
//     const alreadyExists =
//       await ClientRentHistory.findOne({
//         clientId: client._id,
//         month,
//         year,
//       });

//     if (alreadyExists) {
//       return alreadyExists;
//     }

//     // Previous Due
//     const lastHistory =
//       await ClientRentHistory.findOne({
//         clientId: client._id,
//       }).sort({
//         year: -1,
//         month: -1,
//         createdAt: -1,
//       });

//     const previousDue =
//       lastHistory?.currentDue || 0;

//     const monthlyRent = Number(
//       bed.monthlyRent || 0
//     );

//     let depositAmount = 0;

//     if (client.stayType === "P. Booked") {
//       depositAmount = Number(bed.depositAmount || 0);
//     }

//     const processingFees = Number(
//       client.processingFees || 0
//     );

//     const parkingCharges = Number(
//       client.stayType === "T. Booked"
//         ? client.temporaryParkingCharges || 0
//         : client.parkingCharges || 0
//     );

//     let rentReceived = 0;
//     if (client.stayType === "P. Booked") {
//       rentReceived = Number(client.bookingAmount || 0) - Number(client.temporaryTotalAmount || 0);
//     } else if (client.stayType === "T. Booked") {
//       rentReceived = Number(client.temporaryTotalAmount || 0);
//       // rentReceived = 0;
//     }

//     const noticeLastDate = client.noticeLastDate
//       ? new Date(client.noticeLastDate)
//       : null;
//     // Business rule: month ka end (31 ko 30 treat karna)
//     const lastDay = new Date(year, month, 0).getDate();

//     const monthEndDate = new Date(
//       year,
//       month - 1,
//       lastDay === 31 ? 30 : lastDay
//     );

//     let endDate;

//     if (noticeLastDate) {
//       endDate =
//         noticeLastDate > monthEndDate
//           ? monthEndDate
//           : noticeLastDate;
//     } else {
//       endDate = monthEndDate;
//     }

//     const daysCount = getDaysCount(
//       client.clientDoj,
//       endDate,
//       month,
//       year
//     );

//     const calculation =
//       calculateRentHistory({
//         monthlyRent,
//         depositAmount,
//         daysCount,
//         previousDue,
//         ebAmt: 0,
//         flatEB: 0,
//         adjEB: 0,
//         adjAmt: 0,
//         processingFees,
//         parkingCharges,
//         processingFeesReceived: 0,
//         depositAmountReceived: 0,
//         rentReceived,
//       });

//     const history =
//       await ClientRentHistory.create({
//         clientId: client._id,
//         bookingId: client.bookingId || null,
//         propertyId: client.propertyId,
//         bedId: client.bedId,
//         stayType: client.stayType,
//         month,
//         year,
//         startDate: client.clientDoj,
//         endDate,
//         monthName:
//           doj.toLocaleString(
//             "default",
//             {
//               month: "long",
//             }
//           ),
//         ...calculation,
//         paymentComments: "",
//         remarks: "",
//       });
//     return history;
//   } catch (err) {
//     console.error(
//       "Create Rent History Error:",
//       err
//     );
//     throw err;
//   }
// };


const generateMonthlyRent = async () => {
  const today = new Date();
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  // const month = 8;
  // const year = 2026;
  const todayFilterDate = new Date().toISOString().split("T")[0];
  const clients = await Client.find({
    isBookingCancelled: false,
    // noticeStartDate: null,
    $or: [
      { clientVacatingDate: null },
      { clientVacatingDate: "" },
      { clientVacatingDate: { $exists: false } },
      { clientVacatingDate: { $gte: todayFilterDate } },
    ],
  })
    .populate("bedId")
    .lean();
    
  const clientIds = clients.map((client) => client._id);
  const rentHistoryData = [];
  // Already Generated
  const existingHistory = await ClientRentHistory.find({
    month,
    year,
  })
    .select("clientId bedId")
    .lean();
  const existingHistorySet = new Set(
    existingHistory.map(
      (x) => `${x.clientId}_${x.bedId}`
    )
  );
  // Previous Due
  const previousHistory =
    await ClientRentHistory.aggregate([
      {
        $match: {
          clientId: {
            $in: clientIds,
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
        $group: {
          _id: "$clientId",
          currentDue: {
            $first: "$currentDue",
          },
        },
      },
    ]);

  const dueMap = new Map();
  previousHistory.forEach((item) => {
    dueMap.set(
      String(item._id),
      item.currentDue
    );
  });
  for (const client of clients) {
    if (!client.bedId) continue;
    const key = `${client._id}_${client.bedId._id}`;
    if (existingHistorySet.has(key)) {
      continue;
    }
    const previousDue =
      dueMap.get(String(client._id)) || 0;

    const monthlyRent = Number(
      client.bedId.monthlyRent || 0
    );

    const depositAmount = Number(
      client.bedId.depositAmount || 0
    );
    const processingFees = Number(
      client.processingFees || 0
    );
    const parkingCharges = Number(
      client.parkingCharges || 0
    );
    const noticeLastDate = client.noticeLastDate
      ? new Date(client.noticeLastDate)
      : null;
    const clientVacatingDate = client.clientVacatingDate
      ? new Date(client.clientVacatingDate)
      : null;
    // Billing month ka last date (31 ko 30 treat karna)
    const lastDay = new Date(year, month, 0).getDate();
    const monthEndDate = new Date(
      year,
      month - 1,
      lastDay === 31 ? 30 : lastDay
    );
    let endDate;
    if (noticeLastDate && clientVacatingDate) {
      const lastDate =
        noticeLastDate > clientVacatingDate
          ? noticeLastDate
          : clientVacatingDate;
      endDate =
        lastDate > monthEndDate
          ? monthEndDate
          : lastDate;
    } else if (noticeLastDate || clientVacatingDate) {
      const lastDate =
        noticeLastDate || clientVacatingDate;
      endDate =
        lastDate > monthEndDate
          ? monthEndDate
          : lastDate;
    } else {
      endDate = monthEndDate;
    }
    let startDate;
    if (
      month === new Date(client.clientDoj).getMonth() + 1 &&
      year === new Date(client.clientDoj).getFullYear()
    ) {
      startDate = new Date(client.clientDoj);
    } else {
      startDate = new Date(year, month - 1, 1);
    }
    const daysCount = getDaysCount(
      startDate,
      endDate,
      month,
      year
    );
    const calculation =
      calculateRentHistory({
        monthlyRent,
        depositAmount: 0,  // for every month
        daysCount,
        previousDue,
        ebAmt: 0,
        flatEB: 0,
        adjEB: 0,
        adjAmt: 0,
        processingFees: 0,  // for every month
        parkingCharges,
        processingFeesReceived: 0,
        depositAmountReceived: 0,
        rentReceived: 0,
      });
    rentHistoryData.push({
      clientId: client._id,

      bookingId: client.bookingId || null,

      propertyId: client.propertyId,

      bedId: client.bedId._id,

      stayType: client.stayType,

      startDate,
      endDate,

      month,

      year,

      monthName: monthNames[month - 1],

      ...calculation,

      paymentComments: "",

      remarks: "",
    });
  }

  if (!rentHistoryData.length) {
    return {
      insertedCount: 0,
      failedCount: 0,
      total: 0,
      message:
        "No Rent History Generated",
    };
  }

  return await batchInsert(
    ClientRentHistory,
    rentHistoryData,
    500
  );
};




const recalculateRentHistory = async (clientId, isTempToPermanent = false) => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  // Client
  const client = await Client.findById(clientId)
    .populate("bedId", "monthlyRent depositAmount")
    .lean();
  if (!client || !client.bedId) return null;
  // DOJ
  const dojDate = new Date(client.clientDoj);
  let month = currentMonth;
  let year = currentYear;
  // Agar DOJ isi month ka hai
  if (
    dojDate.getMonth() + 1 === currentMonth &&
    dojDate.getFullYear() === currentYear
  ) {
    month = dojDate.getMonth() + 1;
    year = dojDate.getFullYear();
  }
  // Current Rent History
  const history = await ClientRentHistory.findOne({
    clientId,
    bedId: client.bedId._id,
    month,
    year,
  });



let transferredReceived = 0;
if (isTempToPermanent) {
  const cancelledPermanentClient = await Client.findOne({
    bookingId: client.bookingId,
    stayType: "P. Booked",
    isBookingCancelled: true,
    _id: { $ne: client._id },
  });

  if (cancelledPermanentClient) {
    const cancelledPermanentHistory = await ClientRentHistory.findOne({
      clientId: cancelledPermanentClient._id,
    }).sort({
      year: -1,
      month: -1,
      createdAt: -1,
    });

   if (cancelledPermanentHistory) {
  transferredReceived = Number(
    cancelledPermanentHistory.totalReceived || 0
  );

  // Transfer ho gaya, ab old history se received hata do
  cancelledPermanentHistory.totalReceived = 0;
  cancelledPermanentHistory.totalReceivedHistory = [];

  await cancelledPermanentHistory.save();
}
  }
}





  if (!history) {
    throw new Error(
      `Rent history not found for this client in ${monthNames[month - 1]}/${year}.`
    );
  }

  let startDate;
  if (history.startDate) {
    // Transfer ya pehle se saved start date
    startDate = history.startDate;
  } else if (isDOJInBillingMonth) {
    // First month
    startDate = client.clientDoj;
  } else {
    // Normal monthly rent
    startDate = new Date(year, month - 1, 1);
  }
  // DOJ isi billing month ka hai?
  const isDOJInBillingMonth =
    dojDate.getMonth() + 1 === month &&
    dojDate.getFullYear() === year;
  // Notice Last Date OR Vacating Date
  let lastDate = null;
  if (client.noticeLastDate && client.clientVacatingDate) {
    lastDate =
      new Date(client.noticeLastDate) > new Date(client.clientVacatingDate)
        ? client.noticeLastDate
        : client.clientVacatingDate;
  } else if (client.noticeLastDate || client.clientVacatingDate) {
    lastDate = client.noticeLastDate || client.clientVacatingDate;
  } else {
    // Business rule: Every month = 30 days
    lastDate = new Date(year, month - 1, 30);
  }
  // Days Count
  const daysCount = getDaysCount(
    startDate,
    lastDate,
    month,
    year
  );

  const depositAmount = isTempToPermanent
    ? Number(client.bedId.depositAmount || 0)
    : history.depositAmount;

  const processingFees = isTempToPermanent
    ? 500
    : history.processingFees;

  // Calculation
  const calculation = calculateRentHistory({
    monthlyRent: Number(client.bedId.monthlyRent || 0),
    depositAmount,
    // depositAmount: client.bedId.depositAmount,
    daysCount,
    previousDue: history.previousDue,

    ebAmt: history.ebAmt,
    flatEB: history.flatEB,

    adjEB: history.adjEB,
    adjAmt: history.adjAmt,

    processingFees,
    parkingCharges: 0,

    depositAmountReceived:
      history.depositAmountReceived,

   rentReceived:
  Number(history.totalReceived || 0) + transferredReceived,
  });

  Object.assign(history, calculation);
  history.endDate = lastDate;
  history.monthlyRent = client.bedId.monthlyRent;
  // history.depositAmount = client.bedId.depositAmount;
  history.daysCount = daysCount;

if (isTempToPermanent && transferredReceived > 0) {
  history.totalReceivedHistory.push({
    amount: transferredReceived,
    date: new Date(),
  });
}

  await history.save();

  return history;
};

module.exports = {
  generateMonthlyRent,
  createClientRentHistory,
  recalculateRentHistory
};

