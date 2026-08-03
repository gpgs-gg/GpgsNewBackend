const GlobalSettings = require("../models/gobalSettings.model");
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");

// ================= GET GLOBAL SETTINGS =================
const getGlobalSettings = asyncHandler(async (req, res) => {
  let setting = await GlobalSettings.findOne();

  if (!setting) {
    setting = await GlobalSettings.create({
      leadAutoTransfer: false,
      teamAutoAssignment: true,
    });
  }

  res.status(200).json({
    success: true,
    data: setting,
  });
});

// ================= UPDATE GLOBAL SETTINGS =================
const updateGlobalSettings = asyncHandler(async (req, res) => {
  const {
    leadAutoTransfer,
    teamAutoAssignment,
  } = req.body;

  const updateData = {};

  if (typeof leadAutoTransfer === "boolean") {
    updateData.leadAutoTransfer = leadAutoTransfer;
  }

  if (typeof teamAutoAssignment === "boolean") {
    updateData.teamAutoAssignment = teamAutoAssignment;
  }

  if (!Object.keys(updateData).length) {
    throw new ApiError(
      400,
      "Nothing to update"
    );
  }

  const setting = await GlobalSettings.findOneAndUpdate(
    {},
    {
      $set: updateData,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  res.status(200).json({
    success: true,
    data: setting,
  });
});

module.exports = {
  getGlobalSettings,
  updateGlobalSettings,
};