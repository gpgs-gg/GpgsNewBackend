const GlobalSettings = require("../models/gobalSettings.model");
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");

// ================= GET GLOBAL SETTINGS =================
const getLeadAutoTransfer = asyncHandler(async (req, res) => {
  let setting = await GlobalSettings.findOne();

  if (!setting) {
    setting = await GlobalSettings.create({
      leadAutoTransfer: false,
    });
  }

  res.status(200).json({
    success: true,
    data: setting,
  });
});

// ================= UPDATE GLOBAL SETTINGS =================
const updateLeadAutoTransfer = asyncHandler(async (req, res) => {
  const { leadAutoTransfer } = req.body;

  if (typeof leadAutoTransfer !== "boolean") {
    throw new ApiError(
      400,
      "leadAutoTransfer must be true or false"
    );
  }

  const setting = await GlobalSettings.findOneAndUpdate(
    {},
    {
      leadAutoTransfer,
    },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
    }
  );

  if (!setting) {
    throw new ApiError(
      500,
      "Failed to update global settings"
    );
  }

  res.status(200).json({
    success: true,
    message: `Lead Auto Transfer ${
      leadAutoTransfer ? "Enabled" : "Disabled"
    } Successfully`,
    data: setting,
  });
});

module.exports = {
  getLeadAutoTransfer,
  updateLeadAutoTransfer,
};