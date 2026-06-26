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
    const beds = await Bed.find()
      .populate("propertyId", "propertyCode propertyLocation")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
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
      "propertyCode propertyLocation propertyAddress"
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