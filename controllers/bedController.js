const Bed = require("../models/bed.model");
const Property = require("../models/property.model");
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
      comment,
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
      roomNo,
      bedNo,
    });

    if (existingBed) {
      return res.status(400).json({
        success: false,
        message: "Bed already exists in this room",
      });
    }

    const totalBeds = await Bed.countDocuments();
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
      comment,
      worklogs: [
        {
          message: "Bed Created",
        },
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

      const bedSearch = searchableFields.map((field) => {
        const type = Bed.schema.paths[field].instance;

        if (type === "Number" && !isNaN(search)) {
          return {
            [field]: Number(search),
          };
        }

        return {
          [field]: {
            $regex: search,
            $options: "i",
          },
        };
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
exports.updateBed = async (req, res) => {
  try {
    const bed = await Bed.findById(req.params.id);

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: "Bed not found",
      });
    }

    Object.assign(bed, req.body);

    bed.worklogs.push({
      message: "Bed Updated",
    });

    await bed.save();

    return res.status(200).json({
      success: true,
      message: "Bed updated successfully",
      data: bed,
    });
  } catch (error) {
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