const RentGenerationLog = require("../models/RentGenerationLog.model");

exports.getRentGenerationLogs = async (req, res) => {
  try {
    const logs = await RentGenerationLog.find({})
      .sort({
        year: -1,
        month: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error(
      "❌ Get Rent Generation Logs Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch rent generation logs",
      error: error.message,
    });
  }
};