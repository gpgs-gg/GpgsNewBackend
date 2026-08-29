const ElectricityReading = require("../models/acebReading.model");
const Property = require("../models/acebArea.model");
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");
const roundValue = (value, decimals = 2) => {
  return Number(Number(value).toFixed(decimals));
};
// ================= Create Monthly Electricity Reading =================

const createElectricityReading = asyncHandler(async (req, res) => {
  const {
    propertyId,
    month,
    date,
    flatTotalEB,
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

  const property = await Property.findById(propertyId);

  if (!property) {
    throw new ApiError(404, "Property not found");
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
    propertyId,
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
  const totalUnits = Number(flatTotalUnits) || 0;

  const perUnitCost =
    totalUnits > 0
      ? roundValue(totalEB / totalUnits)
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
          propertyId,
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
      propertyId,
      month,
      date,
      flatTotalEB: totalEB,
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
    const { propertyId, month } = req.query;

    if (!propertyId || !month) {
      throw new ApiError(
        400,
        "propertyId and month are required"
      );
    }

    const reading =
      await ElectricityReading.findOne({
        propertyId,
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
    const { propertyId } = req.params;

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
      propertyId,
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

    const totalUnits =
      Number(flatTotalUnits) || 0;

    const perUnitCost =
      totalUnits > 0
        ? roundValue(totalEB / totalUnits)
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
    const { propertyId, month } = req.query;

    if (!propertyId || !month) {
      throw new ApiError(
        400,
        "propertyId and month are required"
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
        propertyId,
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

module.exports = {
  createElectricityReading,
  getElectricityReading,
  getPropertyElectricityReadings,
  updateElectricityReading,
  getElectricityReadingById,
  getPreviousElectricityReading,
};