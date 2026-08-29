const Client = require("../models/client.model");
const Property = require("../models/property.model");

exports.getPropertyEbCalculationData = async (req, res) => {
  try {
    const { propertyCode, billStartDate, billEndDate } = req.query;

    if (!propertyCode) {
      return res.status(400).json({
        success: false,
        message: "Property code is required",
      });
    }

    // =====================================================
    // PROPERTY
    // =====================================================

    const property = await Property.findOne({
      propertyCode: propertyCode.trim(),
    })
      .select(
        "_id propertyCode propertyName propertyLocation utility bedCount"
      )
      .lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // =====================================================
    // BILL DATE
    // =====================================================

    if (!billStartDate || !billEndDate) {
      return res.status(400).json({
        success: false,
        message: "Bill start date and bill end date are required",
      });
    }

    const startDate = new Date(`${billStartDate}T00:00:00`);
    const endDate = new Date(`${billEndDate}T00:00:00`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid bill dates",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "Bill start date cannot be greater than bill end date",
      });
    }

    // Inclusive total days
    const totalDays =
      Math.floor(
        (endDate.getTime() - startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    // =====================================================
    // CLIENTS
    // =====================================================

    const clients = await Client.find({
      propertyId: property._id,
      isBookingCancelled: false,

      // Vacated clients can be excluded if their vacating
      // date is before the billing cycle.
    })
      .populate(
        "bedId",
        "bedCode roomNo bedNo monthlyRent depositAmount freeEbAsPerBed"
      )
      .lean();

    // =====================================================
    // CLIENT CALCULATION
    // =====================================================

    const responseClients = clients.map((client) => {
      const dailyData = [];

      let eligibleDays = 0;
      let vacationDays = 0;

      const clientDoj = client.clientDoj
        ? new Date(`${client.clientDoj}T00:00:00`)
        : null;

      const clientVacatingDate = client.clientVacatingDate
        ? new Date(`${client.clientVacatingDate}T00:00:00`)
        : null;

      const freeEbPerDay = Number(
        client.bedId?.freeEbAsPerBed || 0
      );

      // -----------------------------------------------------
      // Vacation helper
      // -----------------------------------------------------

      const vacations = client.vacations || [];

      const isVacationDate = (dateString) => {
        return vacations.some((vacation) => {
          const ranges = [
            [
              vacation.vacationStartDate1,
              vacation.vacationLastDate1,
            ],
            [
              vacation.vacationStartDate2,
              vacation.vacationLastDate2,
            ],
          ];

          return ranges.some(([from, to]) => {
            if (!from || !to) return false;

            return (
              dateString >= from &&
              dateString <= to
            );
          });
        });
      };

      // -----------------------------------------------------
      // Calculate each day
      // -----------------------------------------------------

      for (
        let date = new Date(startDate);
        date <= endDate;
        date.setDate(date.getDate() + 1)
      ) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        const dateString = `${year}-${month}-${day}`;

        let present = true;

        // Client DOJ
        if (clientDoj && date < clientDoj) {
          present = false;
        }

        // Client vacating date
        if (clientVacatingDate && date > clientVacatingDate) {
          present = false;
        }

        // Vacation
        const onVacation = isVacationDate(dateString);

        if (onVacation) {
          present = false;
          vacationDays++;
        }

        const freeEb = present ? freeEbPerDay : 0;

        if (present) {
          eligibleDays++;
        }

        dailyData.push({
          date: dateString,
          present: present ? 1 : 0,
          freeEb,
          vacation: onVacation,
        });
      }

      const totalFreeEb = eligibleDays * freeEbPerDay;

      return {
        clientId: client._id,

        fullName: client.fullName,

        propertyId: property._id,
        propertyCode: property.propertyCode,

        bedId: client.bedId?._id,
        bedCode: client.bedId?.bedCode,
        roomNo: client.bedId?.roomNo,
        bedNo: client.bedId?.bedNo,

        clientDoj: client.clientDoj || "",
        clientVacatingDate:
          client.clientVacatingDate || "",

        freeEbPerDay,

        totalDays,

        eligibleDays,

        vacationDays,

        totalFreeEb,

        dailyData,
      };
    });

    // =====================================================
    // PROPERTY TOTAL
    // =====================================================

    const totalFreeEb = responseClients.reduce(
      (sum, client) => sum + Number(client.totalFreeEb || 0),
      0
    );

    return res.status(200).json({
      success: true,

      property: {
        _id: property._id,
        propertyCode: property.propertyCode,
        propertyName: property.propertyName,
        propertyLocation: property.propertyLocation,

        ebStartCycle: property.utility?.ebStartCycle || null,
        ebEndCycle: property.utility?.ebEndCycle || null,
      },

      billPeriod: {
        startDate: billStartDate,
        endDate: billEndDate,
        totalDays,
      },

      totalClients: responseClients.length,

      totalFreeEb,

      clients: responseClients,
    });
  } catch (error) {
    console.error(
      "Property EB Calculation Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};