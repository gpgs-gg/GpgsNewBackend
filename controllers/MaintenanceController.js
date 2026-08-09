const Property = require("../models/property.model");

const MaintenanceRecord = require("../models/maintenanceRecord.model");
const OptionsData = require("../models/options.model");
const asyncHandler = require("../middleware/asyncHandler");
/* ======================================================
   FETCH MAINTENANCE DATA
====================================================== */

const fetchMaintenanceData = asyncHandler(async (req, res) => {
  // 1. Activities
  // const activities = await MaintenanceActivity.find({
  //   isActive: true,
  // }).sort({
  //   displayOrder: 1,
  // });

  // Fetch Maintenance Activities and Notifications from OptionsData
  const [master, notificationMaster] = await Promise.all([
    OptionsData.findOne({
      categoryKey: "maintenanceactivities", // lowercase because schema stores lowercase
    }),
    OptionsData.findOne({
      categoryKey: "maintenancenotification",
    }),
  ]);

  // Build a map of notification values for quick lookup
  const notificationMap = {};

  notificationMaster?.items
    ?.filter((item) => item.isActive)
    .forEach((item) => {
      notificationMap[item.label.trim().toLowerCase()] =
        Number(item.value) || 0;
    });
  // Build the activities array with frequency and notification values
  const activities =
    master.items
      .filter((item) => item.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => ({
        activityId: item._id,
        activityName: item.label,
        frequency: Number(item.value),
        notifyBefore: notificationMap[item.label.trim().toLowerCase()] ?? 0,
      })) || [];
  // 2. Properties
  const properties = await Property.find(
    {},
    {
      propertyCode: 1,
    },
  ).sort({
    propertyCode: 1,
  });

  // 3. Records

  const records = await MaintenanceRecord.find()
    .populate("propertyId", "propertyCode")
    .populate("history.updatedBy", "name");

  // 4. Headers
  const headers = [
    "SrNo",
    "Activities",
    "Freq",
    "Notify",
    ...properties.map((p) => ({
      title: p.propertyCode,
      propertyId: p._id,
    })),
  ];

  // 5. Rows
  const data = activities.map((activity, index) => {
    const row = {
      SrNo: index + 1,
      activityId: activity.activityId,
      Activities: activity.activityName,
      Freq: activity.frequency,
      Notify: activity.notifyBefore,
    };

    properties.forEach((property) => {
      const record = records.find(
        (r) =>
          r.propertyId._id.toString() === property._id.toString() &&
          r.activityId.toString() === activity.activityId.toString(),
      );

      if (!record || record.history.length === 0) {
        row[property.propertyCode] = "NA";
        return;
      }

      const history = [...record.history]
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .map((h) => {
          const date = new Date(h.completedDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });

          const completedAt = new Date(h.completedAt).toLocaleString("en-IN", {
            hour12: false,
          });

          const updatedBy = h.updatedByName || h.updatedBy?.name || "Unknown";

          return `${date}_[${completedAt} - ${updatedBy}]`;
        });

      row[property.propertyCode] = history.join("$") + "$";
    });

    return row;
  });

  res.status(200).json({
    success: true,
    headers,
    total: data.length,
    data,
  });
});

/* ======================================================
   UPDATE MAINTENANCE DATA
====================================================== */

const updateMaintenanceData = asyncHandler(async (req, res) => {
  const { updates } = req.body;

  if (!updates?.length) {
    return res.status(400).json({
      success: false,
      message: "Updates are required",
    });
  }

  const operations = [];

  for (const update of updates) {
    if (!update.activityId) continue;
    for (const column of update.columns) {
      if (!column.propertyId) continue;

      operations.push({
        updateOne: {
          filter: {
            propertyId: column.propertyId,
            activityId: update.activityId,
          },

          update: {
            $push: {
              history: {
                $each: [
                  {
                    completedDate: new Date(column.value),
                    completedAt: new Date(),
                    updatedBy: req.user?._id,
                    updatedByName:
                      column.updatedByName || req.user?.name || "Unknown",
                    remarks: "",
                    attachments: [],
                  },
                ],
                $position: 0,
                $slice: 40,
              },
            },
          },

          upsert: true,
        },
      });
    }
  }

  if (operations.length) {
    await MaintenanceRecord.bulkWrite(operations);
  }

  res.status(200).json({
    success: true,
    message: "Maintenance updated successfully.",
  });
});

/* ======================================================
   DATE PARSER
====================================================== */

function parseDate(value) {
  const [day, month, year] = value.split(" ");

  const months = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  return new Date(year, months[month], Number(day));
}

module.exports = {
  fetchMaintenanceData,
  updateMaintenanceData,
};