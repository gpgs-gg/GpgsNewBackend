const PropertySequence = require("../models/propertySequence.model");

// Create property sequence in bulk
exports.createPropertySequenceBulk = async (req, res) => {
  try {
    const { propertyCodes } = req.body;
    // Example: "P1 P2 P3 P4 P5"
    if (!propertyCodes || typeof propertyCodes !== "string") {
      return res.status(400).json({
        success: false,
        message: "propertyCodes is required. Example: P1 P2 P3 P4",
      });
    }
    // Convert space-separated codes into array
    const codes = propertyCodes.trim().split(/\s+/).filter(Boolean);
    if (!codes.length) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one property code",
      });
    }
    // Remove duplicate codes while maintaining order
    const uniqueCodes = [...new Set(codes)];
    // Remove all existing property sequences
    await PropertySequence.deleteMany({});
    // Create new sequence starting from 1
    const sequenceData = uniqueCodes.map((propertyCode, index) => ({
      propertyCode,
      sequence: index + 1,
    }));
    // Insert new property sequences
    const createdSequences = await PropertySequence.insertMany(sequenceData);
    return res.status(201).json({
      success: true,
      message: "Property sequences replaced successfully",
      count: createdSequences.length,
      data: createdSequences,
    });
  } catch (error) {
    console.error("Create property sequence bulk error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to replace property sequences",
      error: error.message,
    });
  }
};
// Get all property sequences
exports.getAllPropertySequences = async (req, res) => {
  try {
    const propertySequences = await PropertySequence.find({})
      .sort({ sequence: 1 })
      .select("propertyCode sequence createdAt updatedAt");

    return res.status(200).json({
      success: true,
      count: propertySequences.length,
      data: propertySequences,
    });
  } catch (error) {
    console.error("Get all property sequences error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get property sequences",
      error: error.message,
    });
  }
};