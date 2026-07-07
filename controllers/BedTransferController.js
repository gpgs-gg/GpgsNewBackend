
const Client = require("../models/client.model");
const Bed = require("../models/bed.model");
const ClientRentHistory = require("../models/clientRentHistory.model");
const getDaysCount = require("../utils/getDaysCount");
const calculateRentHistory = require("../utils/calculateRentHistory");

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

const transferBed = async (req, res) => {
  try {
    const {
      clientId,
      newPropertyId,
      newBedId,
      endDate,
      startDate
    } = req.body;

    if (!clientId || !newPropertyId || !newBedId) {
      return res.status(400).json({
        success: false,
        message:
          "clientId, newPropertyId and newBedId are required",
      });
    }

    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Same Bed Check
    if (
      String(client.propertyId) === String(newPropertyId) &&
      String(client.bedId) === String(newBedId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Client is already assigned to this bed",
      });
    }

    // New Bed
    const newBed = await Bed.findById(newBedId);

    if (!newBed) {
      return res.status(404).json({
        success: false,
        message: "New bed not found",
      });
    }

    // Occupied Check
    const occupied = await Client.findOne({
      _id: { $ne: clientId },
      propertyId: newPropertyId,
      bedId: newBedId,
      isBookingCancelled: false,
      $or: [
        { noticeStartDate: { $exists: false } },
        { noticeStartDate: null },
      ],
    });

    if (occupied) {
      return res.status(400).json({
        success: false,
        message: "Bed already occupied",
      });
    }

    const now = new Date(endDate);

    // First Time History
    if (!client.bedHistory) {
      client.bedHistory = [];
    }

    if (client.bedHistory.length === 0) {
      client.bedHistory.push({
        propertyId: client.propertyId,
        bedId: client.bedId,
        stayType: client.stayType,
        monthlyRent: client.monthlyRent,
        depositAmount: client.depositAmount,
        processingFees: client.processingFees,
        parkingCharges: client.parkingCharges,
        fromDate: client.clientDoj || now,
        toDate: now,
      });
    } else {
      const active =
        client.bedHistory[client.bedHistory.length - 1];

      if (!active.toDate) {
        active.toDate = now;
      }
    }

    // New Bed History
    client.bedHistory.push({
      propertyId: newPropertyId,
      bedId: newBedId,
      stayType: client.stayType,
      monthlyRent: newBed.monthlyRent,
      depositAmount: newBed.depositAmount,
      processingFees: client.processingFees,
      parkingCharges: client.parkingCharges,
      fromDate: new Date(startDate),
      toDate: null,
    });

    const oldPropertyId = client.propertyId;
    const oldBedId = client.bedId;

    // Current Bed Change
    client.propertyId = newPropertyId;
    client.bedId = newBedId;

    client.worklogs.push({
      message: `Client shifted from Property ${oldPropertyId} Bed ${oldBedId} to Property ${newPropertyId} Bed ${newBedId}`,
      createdAt: now,
    });

    await client.save();

    // ..................................
    // const today = new Date(client?.clientDoj);
    // const month = today.getMonth() + 1;
    // const year = today.getFullYear();

    const currentDate = new Date();
    const doj =
      new Date(client.clientDoj).getMonth() === currentDate.getMonth() &&
        new Date(client.clientDoj).getFullYear() === currentDate.getFullYear()
        ? new Date(client.clientDoj)
        : currentDate;

    const month = doj.getMonth() + 1;
    const year = doj.getFullYear();

    // const lastHistory = await ClientRentHistory.findOne({
    //   clientId: client._id,
    // }).sort({
    //   year: -1,
    //   month: -1,
    //   createdAt: -1,
    // });

    // let previousDue = 0;
    // let extraReceived = 0;

    // if (lastHistory) {
    //   if (lastHistory.currentDue < 0) {
    //     extraReceived = Math.abs(lastHistory.currentDue); // 500
    //     previousDue = 0;
    //   } else {
    //     previousDue = lastHistory.currentDue;
    //   }
    // }

    // extraReceived +=
    //   Number(lastHistory.previousDue || 0) + Number(lastHistory.depositAmount || 0)


    let previousDue = 0;
    let extraReceived = 0;


    // New Bed Charges
    const monthlyRent = Number(newBed.monthlyRent || 0);
    const depositAmount = Number(newBed.depositAmount || 0);

    const oldHistory = await ClientRentHistory.findOne({
      clientId: client._id,
      bedId: oldBedId,
      month,
      year,
    }).sort({ createdAt: -1 });


const firstHistory = await ClientRentHistory.findOne({
  clientId: client._id,
  bedId: oldBedId,
})
  .sort({
    year: 1,
    month: 1,
    createdAt: 1,
  });

const carryDeposit = Number(firstHistory?.depositAmount || 0);



    let daysCount;
    if (oldHistory) {
      // 1 month = 30 days business rule
      const currentBedHistory = client.bedHistory
        .filter(
          (h) =>
            String(h.bedId) === String(oldBedId) &&
            new Date(h.fromDate).getMonth() + 1 === month &&
            new Date(h.fromDate).getFullYear() === year
        )
        .sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate))[0];

      const calculationStartDate = currentBedHistory
        ? new Date(currentBedHistory.fromDate)
        : new Date(year, month - 1, 1);

      const shiftedDays = getDaysCount(
        calculationStartDate,
        new Date(endDate),
        month,
        year
      );

      // Old history recalculate
      const oldCalculation = calculateRentHistory({
        monthlyRent: oldHistory.monthlyRent,
        depositAmount: oldHistory.depositAmount,

        daysCount: shiftedDays,

        previousDue: oldHistory.previousDue,

        rentReceived: oldHistory.totalReceived,

        ebAmt: oldHistory.ebAmt,
        flatEB: oldHistory.flatEB,
        adjEB: oldHistory.adjEB,
        adjAmt: oldHistory.adjAmt,

        processingFees: oldHistory.processingFees,
        parkingCharges: oldHistory.parkingCharges,

        processingFeesReceived: oldHistory.processingFeesReceived,
        depositAmountReceived: oldHistory.depositAmountReceived,
      });

      Object.assign(oldHistory, oldCalculation);

      oldHistory.daysCount = shiftedDays;
      oldHistory.paymentStatus = "Shifted";

      await oldHistory.save();


      if (oldHistory.currentDue < 0) {
        previousDue = 0;

        extraReceived =
          Math.abs(oldHistory.currentDue) +
          carryDeposit;
      } else {
        previousDue = oldHistory.currentDue;

        extraReceived = carryDeposit;
      }


      const monthHistories = await ClientRentHistory.find({
        clientId: client._id,
        month,
        year,
        paymentStatus: "Shifted",
      });

      const consumedDays = monthHistories.reduce(
        (sum, item) => sum + Number(item.daysCount || 0),
        0
      );

      daysCount = 30 - consumedDays;
    } else {

      const lastHistory = await ClientRentHistory.findOne({
        clientId: client._id,
      }).sort({
        year: -1,
        month: -1,
        createdAt: -1,
      });

      if (lastHistory) {

        if (lastHistory.currentDue < 0) {
          previousDue = 0;

          extraReceived =
            Math.abs(lastHistory.currentDue) +
            Number(lastHistory.depositAmount || 0);

        } else {

          previousDue = lastHistory.currentDue;

          extraReceived =
            Number(lastHistory.depositAmount || 0);
        }
      }

      daysCount = getDaysCount(
        new Date(startDate),
        null,
        month,
        year
      );
    }

    const calculation = calculateRentHistory({
      monthlyRent,
      depositAmount,
      daysCount,
      previousDue,
      rentReceived: extraReceived,
      ebAmt: 0,
      flatEB: 0,
      adjEB: 0,
      adjAmt: 0,
      processingFees: client.processingFees || 0,
      parkingCharges: client.parkingCharges || 0,
      processingFeesReceived: 0,
      depositAmountReceived: 0,
    });


    await ClientRentHistory.create({
      clientId: client._id,

      bookingId: client.bookingId,

      propertyId: newPropertyId,

      bedId: newBedId,

      stayType: client.stayType,

      month,
      year,

      monthName: monthNames[month - 1],

      ...calculation,
      paymentComments: "",
      remarks: "",
    });
    // ................................................


    const updatedClient = await Client.findById(client._id)
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
        "bedCode roomNo bedNo monthlyRent depositAmount"
      );

    return res.status(200).json({
      success: true,
      message: "Bed transferred successfully",
      data: updatedClient,
    });
  } catch (error) {
    console.error("Transfer Bed Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  transferBed,
};

