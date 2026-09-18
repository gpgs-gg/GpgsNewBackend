const Bed = require("../models/bed.model");
const Property = require("../models/property.model");
const mongoose = require("mongoose");
const { generateWorkLogs, createWorkLog } = require("../utils/worklog");

// Create Bed
exports.createBed = async (req, res) => {
  try {
    const {
      propertyId,
      roomNo,
      bedNo,
      gender,
      sharingType,
      bathAttached,
      acRoom,
      monthlyRent,
      securityDepositMultiplicationFactor,
      upcomingRentHikeDate,
      upcomingRentHikeAmount,
      previousRentHikeDate,
      bedAvailable,
      bedAdditionalStatus,
      freeEbAsPerBed,
      comment,
      createdByName,
      updatedByName
    } = req.body;

    const property = await Property.findById(propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const existingBed = await Bed.findOne({
      propertyId,
      bedNo,
    });

    if (existingBed) {
      return res.status(400).json({
        success: false,
        message: `Bed ${bedNo} already exists in this Property`,
      });
    }

    // const totalBeds = await Bed.countDocuments();
    const bed = await Bed.create({
      propertyId,
      roomNo,
      bedNo,
      gender,
      sharingType,
      bathAttached,
      acRoom,
      monthlyRent,
      securityDepositMultiplicationFactor,
      upcomingRentHikeDate,
      upcomingRentHikeAmount,
      previousRentHikeDate,
      bedAvailable,
      bedAdditionalStatus,
      freeEbAsPerBed,
      comment,
      worklogs: [
        createWorkLog({
          message: `Bed created by ${createdByName || updatedByName}`,
          createdBy: createdByName || updatedByName,
        }),
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Bed created successfully",
      data: bed,
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Get All
exports.getBeds = async (req, res) => {
  try {
    // Pagination
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;
    // Build Query
    const query = {};
    if (req.query.search?.trim()) {
      const search = req.query.search.trim();
      const searchableFields = Object.keys(Bed.schema.paths).filter((key) => {
        const type = Bed.schema.paths[key].instance;

        return (
          ["String", "Number"].includes(type) &&
          !["_id", "__v"].includes(key)
        );
      });

      const bedSearch = searchableFields.flatMap((field) => {
        const type = Bed.schema.paths[field].instance;

        // String fields
        if (type === "String") {
          return [{
            [field]: {
              $regex: search,
              $options: "i",
            },
          }];
        }

        // Number fields
        if (type === "Number" && !isNaN(search)) {
          return [{
            [field]: Number(search),
          }];
        }
        // Agar Number field hai aur search text hai (RH-TEST-00003),
        // to kuch bhi mat return karo.
        return [];
      });
      // Search in Property collection
      const properties = await Property.find({
        $or: [
          { propertyCode: { $regex: search, $options: "i" } },
          { propertyLocation: { $regex: search, $options: "i" } },
          { propertyName: { $regex: search, $options: "i" } },
        ],
      }).select("_id");
      const propertyIds = properties.map((p) => p._id);

      // Merge Bed search + Property search
      query.$or = [
        ...bedSearch,
        ...(propertyIds.length
          ? [{ propertyId: { $in: propertyIds } }]
          : []),
      ];
    }
    // ================= Filters =================
    if (req.query.propertyId) {
      query.propertyId = req.query.propertyId;
    }
    if (req.query.gender) {
      query.gender = req.query.gender;
    }
    if (req.query.sharingType) {
      query.sharingType = req.query.sharingType;
    }
    if (req.query.bathAttached) {
      query.bathAttached = req.query.bathAttached;
    }
    if (req.query.propertyLocation) {
      const properties = await Property.find({
        propertyLocation: req.query.propertyLocation,
      }).select("_id");

      query.propertyId = {
        $in: properties.map((p) => p._id),
      };
    }
    if (req.query.acRoom) {
      query.acRoom = req.query.acRoom;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.roomNo) {
      query.roomNo = req.query.roomNo;
    }
    if (req.query.bedNo) {
      query.bedNo = req.query.bedNo;
    }
    if (req.query.monthlyRentMin || req.query.monthlyRentMax) {
      query.monthlyRent = {};

      if (req.query.monthlyRentMin) {
        query.monthlyRent.$gte = Number(req.query.monthlyRentMin);
      }

      if (req.query.monthlyRentMax) {
        query.monthlyRent.$lte = Number(req.query.monthlyRentMax);
      }
    }
    if (req.query.sdmfMin || req.query.sdmfMax) {
      query.securityDepositMultiplicationFactor = {};

      if (req.query.sdmfMin) {
        query.securityDepositMultiplicationFactor.$gte = Number(
          req.query.sdmfMin,
        );
      }

      if (req.query.sdmfMax) {
        query.securityDepositMultiplicationFactor.$lte = Number(
          req.query.sdmfMax,
        );
      }
    }
    if (req.query.depositAmountMin || req.query.depositAmountMax) {
      query.depositAmount = {};

      if (req.query.depositAmountMin) {
        query.depositAmount.$gte = Number(req.query.depositAmountMin);
      }

      if (req.query.depositAmountMax) {
        query.depositAmount.$lte = Number(req.query.depositAmountMax);
      }
    }
    if (
      req.query.upcomingRentHikeDateFrom ||
      req.query.upcomingRentHikeDateTo
    ) {
      query.upcomingRentHikeDate = {};

      if (req.query.upcomingRentHikeDateFrom) {
        query.upcomingRentHikeDate.$gte = new Date(
          req.query.upcomingRentHikeDateFrom,
        );
      }

      if (req.query.upcomingRentHikeDateTo) {
        query.upcomingRentHikeDate.$lte = new Date(
          req.query.upcomingRentHikeDateTo,
        );
      }
    }
    if (
      req.query.upcomingRentHikeAmountMin ||
      req.query.upcomingRentHikeAmountMax
    ) {
      query.upcomingRentHikeAmount = {};

      if (req.query.upcomingRentHikeAmountMin) {
        query.upcomingRentHikeAmount.$gte = Number(
          req.query.upcomingRentHikeAmountMin,
        );
      }

      if (req.query.upcomingRentHikeAmountMax) {
        query.upcomingRentHikeAmount.$lte = Number(
          req.query.upcomingRentHikeAmountMax,
        );
      }
    }
    // Previous Rent Hike Date
    if (
      req.query.previousRentHikeDateFrom ||
      req.query.previousRentHikeDateTo
    ) {
      query.previousRentHikeDate = {};

      if (req.query.previousRentHikeDateFrom) {
        query.previousRentHikeDate.$gte = new Date(
          req.query.previousRentHikeDateFrom,
        );
      }

      if (req.query.previousRentHikeDateTo) {
        query.previousRentHikeDate.$lte = new Date(
          req.query.previousRentHikeDateTo,
        );
      }
    }
    // ================= Count =================
    const totalRecords = await Bed.countDocuments(query);
    // ================= Data =================
    const beds = await Bed.find(query)
      .populate("propertyId", "propertyCode propertyLocation bedCount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    return res.status(200).json({
      success: true,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      hasNextPage: page < Math.ceil(totalRecords / limit),
      hasPrevPage: page > 1,
      count: beds.length,
      data: beds,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Single Bed
exports.getSingleBed = async (req, res) => {
  try {
    const bed = await Bed.findById(req.params.id).populate(
      "propertyId",
      "propertyCode propertyLocation propertyAddress bedCount"
    );

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: "Bed not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: bed,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Update Bed
// Update Bed
exports.updateBed = async (req, res) => {
  try {
    const bed = await Bed.findById(req.params.id);
    // --------------------------------------------------
    // 1. Check bed exists
    // --------------------------------------------------
    if (!bed) {
      return res.status(404).json({
        success: false,
        message: "Bed not found",
      });
    }

    const {
      propertyId,
      roomNo,
      bedNo,
      gender,
      sharingType,
      bathAttached,
      acRoom,
      monthlyRent,
      securityDepositMultiplicationFactor,
      upcomingRentHikeDate,
      upcomingRentHikeAmount,
      previousRentHikeDate,
      bedAvailable,
      bedAdditionalStatus,
      freeEbAsPerBed,
      comment,
    } = req.body;

    // --------------------------------------------------
    // 2. Check property exists
    // --------------------------------------------------
    const property = await Property.findById(propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }
    // --------------------------------------------------
    // 3. Check duplicate bed number in same property
    //    Exclude the current bed being updated
    // --------------------------------------------------
    const existingBed = await Bed.findOne({
      propertyId,
      bedNo,
      _id: { $ne: bed._id },
    });

    if (existingBed) {
      return res.status(400).json({
        success: false,
        message: `Bed ${bedNo} already exists in this property`,
      });
    }

    // --------------------------------------------------
    // 4. Get user
    // --------------------------------------------------
    const user = req.body.updatedByName || req.body.createdByName || "System";
    // --------------------------------------------------
    // 5. Keep old data BEFORE modifying bed
    // --------------------------------------------------
    const oldBedData = bed.toObject();

    // --------------------------------------------------
    // 6. Prepare new data
    // --------------------------------------------------
    const newBedData = {
      ...oldBedData,

      propertyId,
      roomNo,
      bedNo,
      gender,
      sharingType,
      bathAttached,
      acRoom,
      monthlyRent,
      securityDepositMultiplicationFactor,
      upcomingRentHikeDate,
      upcomingRentHikeAmount,
      previousRentHikeDate,
      bedAvailable,
      bedAdditionalStatus,
      freeEbAsPerBed,
      comment,
    };

    // --------------------------------------------------
    // 7. Generate automatic worklogs
    // --------------------------------------------------
    const automaticWorkLogs = generateWorkLogs({
      oldData: oldBedData,
      newData: newBedData,
      createdBy: user,

      ignoredFields: [
        "propertyId",
        "worklogs",

        // Mongo/system fields
        "_id",
        "__v",
        "createdAt",
        "updatedAt",

        // User/helper fields
        "createdByName",
        "updatedByName",
        "newWorkLog",

        // Derived field
        "depositAmount",
      ],
    });

    // --------------------------------------------------
    // 8. Add automatic worklogs
    // --------------------------------------------------
    bed.worklogs.push(...automaticWorkLogs);

    // --------------------------------------------------
    // 9. Add manually entered worklog
    // --------------------------------------------------
    const newWorkLog = String(req.body.newWorkLog || "").trim();

    if (newWorkLog) {
      bed.worklogs.push(
        createWorkLog({
          message: newWorkLog,
          createdBy: user,
        }),
      );
    }
    // --------------------------------------------------
    // 4. Update bed
    // --------------------------------------------------
    Object.assign(bed, {
      propertyId,
      roomNo,
      bedNo,
      gender,
      sharingType,
      bathAttached,
      acRoom,
      monthlyRent,
      securityDepositMultiplicationFactor,
      upcomingRentHikeDate,
      upcomingRentHikeAmount,
      previousRentHikeDate,
      bedAvailable,
      bedAdditionalStatus,
      freeEbAsPerBed,
      comment,
    });


    await bed.save();

    return res.status(200).json({
      success: true,
      message: "Bed updated successfully",
      data: bed,
    });
  } catch (error) {
    // MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This bed number already exists in this property",
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Delete Bed
exports.deleteBed = async (req, res) => {
  try {
    const bed = await Bed.findByIdAndDelete(req.params.id);

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: "Bed not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bed deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Multiple Beds
exports.deleteMultipleBeds = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide bed ids.",
      });
    }

    const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));

    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: "One or more bed ids are invalid.",
      });
    }

    const result = await Bed.deleteMany({
      _id: { $in: ids },
    });

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} bed${result.deletedCount === 1 ? "" : "s"} deleted successfully.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};