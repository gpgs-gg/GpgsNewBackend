const ElectricityReading = require("../models/acebReading.model");
const ACEBPropertyArea = require("../models/acebArea.model");
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");
const ACElectricityReading = require("../models/acebReading.model");
const roundValue = (value, decimals = 2) => {
  return Number(Number(value).toFixed(decimals));
};
// ================= Create Monthly Electricity Reading =================

const createElectricityReading = asyncHandler(async (req, res) => {
  const {
    roomId,
    month,
    date,
    flatTotalEB,
    eBToBeRecovered,
    flatTotalUnits,
    roomReadings = [],
    lastMonth,
  } = req.body;

  // ================= Validation =================

  if (!propertyId || !month || !date) {
    throw new ApiError(
      400,
      "Property, month and date are required"
    );
  }

  // ================= Check Property =================

  const property = await ACEBPropertyArea.findById(roomId);

  if (!property) {
    throw new ApiError(404, "ACEBPropertyArea not found");
  }


  if (lastMonth !== undefined) {
    // जर lastMonth array असेल
    if (Array.isArray(lastMonth)) {
      for (const item of lastMonth) {
        const existingIndex = property.lastMonth?.findIndex(
          (existing) => existing.areaId === item.areaId
        );

        if (existingIndex !== undefined && existingIndex >= 0) {
          // Existing value replace
          property.lastMonth[existingIndex] = item;
        } else {
          // New value push
          if (!property.lastMonth) {
            property.lastMonth = [];
          }

          property.lastMonth.push(item);
        }
      }
    } else {
      // जर lastMonth single value असेल
      property.lastMonth = lastMonth;
    }

    await property.save();
  }


  // ================= Check Duplicate Month =================

  const existingReading = await ElectricityReading.findOne({
    ACEBPropertyAreaId: roomId,
    month,
  });

  if (existingReading) {
    throw new ApiError(
      409,
      `Electricity reading already exists for ${month}`
    );
  }

  // ================= Per Unit Cost =================

  const totalEB = Number(flatTotalEB) || 0;
  const eBToBeRecoveredTotal = Number(eBToBeRecovered) || 0;
  const totalUnits = Number(flatTotalUnits) || 0;

  const perUnitCost =
    totalUnits > 0
      ? roundValue(eBToBeRecoveredTotal / totalUnits)
      : 0;

  // ================= Prepare Room Readings =================

  const calculatedRoomReadings = [];

  for (const room of roomReadings) {
    const propertyArea = property.areas.find(
      (area) => area.areaId === room.areaId
    );

    if (!propertyArea) {
      throw new ApiError(
        400,
        `Invalid areaId: ${room.areaId}`
      );
    }

    if (
      room.currentReading === undefined ||
      room.currentReading === null ||
      room.currentReading === ""
    ) {
      continue;
    }
    const currentReading = roundValue(
      Number(room.currentReading)
    );

    let previousReading;

    // If previous reading manually provided
    if (
      room.previousReading !== undefined &&
      room.previousReading !== null &&
      room.previousReading !== ""
    ) {
      previousReading = roundValue(
        Number(room.previousReading) || 0
      );
    } else {
      // Otherwise find previous month's reading
      const previousMonthReading =
        await ElectricityReading.findOne({
          roomId,
          "roomReadings.areaId": room.areaId,
        }).sort({
          date: -1,
        });

      if (previousMonthReading) {
        const previousRoom =
          previousMonthReading.roomReadings.find(
            (item) => item.areaId === room.areaId
          );

        previousReading = roundValue(
          previousRoom?.currentReading || 0
        );
      } else {
        previousReading = 0;
      }
    }

    // ================= Consumed Units =================

    const consumedUnits = roundValue(
      currentReading - previousReading
    );

    // ================= Room ACEB =================
    const aceb = roundValue(
      consumedUnits * perUnitCost
    );

    calculatedRoomReadings.push({
      areaId: propertyArea.areaId,
      name: propertyArea.name,
      currentReading,
      previousReading,
      consumedUnits,
      aceb,
    });
  }

  // ================= Actual Total Units =================

  const actualTotalUnits = roundValue(
    calculatedRoomReadings.reduce(
      (sum, room) => sum + room.consumedUnits,
      0
    )
  );

  // ================= Actual Total EB =================

  const actualTotalEB = roundValue(
    actualTotalUnits * perUnitCost
  );

  // ================= Common Total EB =================
  const commonTotalEB = roundValue(
    totalEB - actualTotalEB
  );

  // ================= Save =================

  const electricityReading =
    await ElectricityReading.create({
      ACEBPropertyAreaId: roomId,
      propertyId: property?.propertyId,
      month,
      date,
      flatTotalEB: totalEB,
      eBToBeRecovered,
      flatTotalUnits: totalUnits,
      perUnitCost,
      roomReadings: calculatedRoomReadings,
      actualTotalUnits,
      actualTotalEB,
      commonTotalEB,
    });

  res.status(201).json({
    success: true,
    message:
      "Electricity reading created successfully",
    data: electricityReading,
  });
});

// ================= Get Monthly Electricity Reading =================

const getElectricityReading = asyncHandler(
  async (req, res) => {
    const { roomId, month } = req.query;

    if (!roomId || !month) {
      throw new ApiError(
        400,
        "roomId and month are required"
      );
    }

    const reading =
      await ElectricityReading.findOne({
        ACEBPropertyAreaId: roomId,
        month,
      })
        .populate(
          "propertyId",
          "propertyCode propertyName"
        )
        .lean();

    if (!reading) {
      throw new ApiError(
        404,
        "Electricity reading not found"
      );
    }

    res.status(200).json({
      success: true,
      data: reading,
    });
  }
);

// ================= Get All Months For Property =================

const getPropertyElectricityReadings =
  asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const page = Math.max(
      Number(req.query.page) || 1,
      1
    );
    const limit = Math.max(
      Number(req.query.limit) || 10,
      1
    );

    const skip = (page - 1) * limit;

    const query = {
      ACEBPropertyAreaId: roomId,
    };

    // ================= SEARCH =================

    if (req.query.search?.trim()) {
      query.month = {
        $regex: req.query.search.trim(),
        $options: "i",
      };
    }

    // ================= TOTAL =================

    const totalRecords =
      await ElectricityReading.countDocuments(query);

    // ================= DATA =================

    const readings =
      await ElectricityReading.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const totalPages =
      Math.ceil(totalRecords / limit);

    res.status(200).json({
      success: true,
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      count: readings.length,
      data: readings,
    });
  });

// ================= Update Monthly Electricity Reading =================

const updateElectricityReading = asyncHandler(
  async (req, res) => {
    const { id } = req.params;

    const {
      date,
      flatTotalEB,
      flatTotalUnits,
      eBToBeRecovered,
      roomReadings = [],
    } = req.body;

    const existingReading =
      await ElectricityReading.findById(id);

    if (!existingReading) {
      throw new ApiError(
        404,
        "Electricity reading not found"
      );
    }

    // ================= Per Unit Cost =================

    const totalEB =
      Number(flatTotalEB) || 0;

    const eBToBeRecoveredTotal =
      Number(eBToBeRecovered) || 0;

    const totalUnits =
      Number(flatTotalUnits) || 0;

    const perUnitCost =
      totalUnits > 0
        ? roundValue(eBToBeRecoveredTotal / totalUnits)
        : 0;

    // ================= Calculate Room Readings =================

    const calculatedRoomReadings = [];

    for (const room of roomReadings) {
      const currentReading = roundValue(
        Number(room.currentReading) || 0
      );

      const previousReading = roundValue(
        Number(room.previousReading) || 0
      );

      const consumedUnits = roundValue(
        currentReading - previousReading
      );

      const aceb = roundValue(
        consumedUnits * perUnitCost
      );

      calculatedRoomReadings.push({
        areaId: room.areaId,
        currentReading,
        previousReading,
        consumedUnits,
        aceb,
      });
    }

    // ================= Total Units =================

    const actualTotalUnits = roundValue(
      calculatedRoomReadings.reduce(
        (sum, room) => sum + room.consumedUnits,
        0
      )
    );

    // ================= Actual EB =================

    const actualTotalEB = roundValue(
      actualTotalUnits * perUnitCost
    );

    // ================= Common EB =================

    const commonTotalEB = roundValue(
      totalEB - actualTotalEB
    );

    // ================= Update =================

    existingReading.date =
      date || existingReading.date;

    existingReading.flatTotalEB =
      totalEB;
    existingReading.eBToBeRecovered =
      eBToBeRecoveredTotal;

    existingReading.flatTotalUnits =
      totalUnits;

    existingReading.perUnitCost =
      perUnitCost;

    existingReading.roomReadings =
      calculatedRoomReadings;

    existingReading.actualTotalUnits =
      actualTotalUnits;

    existingReading.actualTotalEB =
      actualTotalEB;

    existingReading.commonTotalEB =
      commonTotalEB;

    await existingReading.save();

    res.status(200).json({
      success: true,
      message:
        "Electricity reading updated successfully",
      data: existingReading,
    });
  }
);


const getElectricityReadingById =
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const reading =
      await ElectricityReading.findById(id)
        .populate(
          "propertyId",
          "propertyCode propertyName"
        )
        .lean();

    if (!reading) {
      throw new ApiError(
        404,
        "Electricity reading not found"
      );
    }

    res.status(200).json({
      success: true,
      data: reading,
    });
  });

// ================= Get Previous Electricity Reading =================

const getPreviousElectricityReading = asyncHandler(
  async (req, res) => {
    const { roomId, month } = req.query;

    if (!roomId || !month) {
      throw new ApiError(
        400,
        "roomId and month are required"
      );
    }

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr",
      "May", "Jun", "Jul", "Aug",
      "Sep", "Oct", "Nov", "Dec",
    ];

    const getMonthDate = (value) => {
      if (!value) return null;

      const match = value.match(
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})$/
      );

      if (!match) return null;

      return new Date(
        Number(match[2]),
        monthNames.indexOf(match[1]),
        1
      );
    };

    const selectedMonthDate = getMonthDate(month);

    if (!selectedMonthDate) {
      throw new ApiError(
        400,
        "Invalid month format"
      );
    }

    // ================= Exact Previous Month =================

    const previousMonthDate = new Date(
      selectedMonthDate
    );

    previousMonthDate.setMonth(
      previousMonthDate.getMonth() - 1
    );

    // ================= Find Previous Month Reading =================

    const readings =
      await ElectricityReading.find({
        ACEBPropertyAreaId: roomId,
      }).lean();

    const previousReading = readings.find(
      (reading) => {
        const readingMonthDate =
          getMonthDate(reading.month);

        return (
          readingMonthDate &&
          readingMonthDate.getTime() ===
          previousMonthDate.getTime()
        );
      }
    );

    // ================= Response =================

    res.status(200).json({
      success: true,
      data: previousReading || null,
    });
  }
);




const getLatestACConsumptionData = async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required",
      });
    }

    // Latest AC electricity reading
    const latestRecord = await ACElectricityReading.findOne({
      propertyId,
    })
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .lean();

    if (!latestRecord) {
      return res.status(404).json({
        success: false,
        message: "No AC electricity reading found for this property",
      });
    }

    // Get area names using ACEBPropertyAreaId
    const areaData = await ACEBPropertyArea.findById(
      latestRecord.ACEBPropertyAreaId
    ).lean();

    // Create areaId -> name mapping
    const areaNameMap = {};

    if (areaData?.areas && Array.isArray(areaData.areas)) {
      areaData.areas.forEach((area) => {
        if (area.areaId && area.name) {
          areaNameMap[String(area.areaId)] = area.name;
        }
      });
    }

    // Default response
    const responseData = {
      FlatTotalEB: latestRecord.flatTotalEB || 0,

      FlatTotalUnits: latestRecord.flatTotalUnits || 0,

      PerUnitCost: latestRecord.perUnitCost || 0,

      // Free EB
      FreeEB:
        (latestRecord.flatTotalEB || 0) -
        (latestRecord.eBToBeRecovered || 0),

      // EB To Be Recovered
      EBToBeRecovered: latestRecord.eBToBeRecovered || 0,

      // AC
      ACTotalUnits: latestRecord.actualTotalUnits || 0,

      ACTotalEB: latestRecord.actualTotalEB || 0,

      // Common EB
      CommonTotalEB: latestRecord.commonTotalEB || 0,
    };

    // Add room-wise AC EB
    if (Array.isArray(latestRecord.roomReadings)) {
      latestRecord.roomReadings.forEach((room) => {
        if (!room.areaId) return;

        // Find room name using areaId
        const roomName = areaNameMap[String(room.areaId)];

        if (!roomName) {
          console.warn(
            `Area name not found for areaId: ${room.areaId}`
          );
          return;
        }

        responseData[`${roomName}`] = room.aceb || 0;
      });
    }

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Get Latest AC Consumption Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get latest AC consumption data",
      error: error.message,
    });
  }
};


module.exports = {
  createElectricityReading,
  getElectricityReading,
  getPropertyElectricityReadings,
  updateElectricityReading,
  getElectricityReadingById,
  getPreviousElectricityReading,
  getLatestACConsumptionData
};