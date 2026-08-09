const Property = require("../models/property.model");

const HousekeepingRecord = require("../models/housekeepingRecord.model");
const OptionsData = require("../models/options.model");
const asyncHandler = require("../middleware/asyncHandler");

const fetchHousekeepingData = asyncHandler(async (req, res) => {
  // 1. Get Housekeeping Activities & Notification Master in parallel
  const [master, notificationMaster] = await Promise.all([
    OptionsData.findOne({
      categoryKey: "housekeppingactivities",
    }),
    OptionsData.findOne({
      categoryKey: "housekeepingnotification",
    }),
  ]);
  // CREATE A LOOKUP MAP FOR NOTIFICATION MASTER DATA
  const notificationMap = {};

  if (notificationMaster) {
    notificationMaster.items
      .filter((item) => item.isActive)
      .forEach((item) => {
        notificationMap[item.label.trim().toLowerCase()] =
          Number(item.value) || 0;
      });
  }

  if (!master) {
    return res.status(404).json({
      success: false,
      message: "Housekeeping master data not found.",
    });
  }
  
  const activities = master.items
    .filter((item) => item.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((item) => ({
      activityId: item._id,
      activityName: item.label,
      frequency: Number(item.value),
      notifyBefore: notificationMap[item.label.trim().toLowerCase()] ?? 0,
    }));
  // 2. Get all active properties
  const properties = await Property.find(
    {},
    {
      propertyCode: 1,
    },
  ).sort({
    propertyCode: 1,
  });
  // 3. Records
  const records = await HousekeepingRecord.find()
    .populate("propertyId", "propertyCode")
    .populate("history.updatedBy", "name");

  // 4. Build headers
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
  // 5. Build rows
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
      // const record = records.find(
      //   (r) =>
      //     r.propertyId._id.toString() === property._id.toString() &&
      //     r.activityId._id.toString() === activity._id.toString(),
      // );

      if (!record || record.history.length === 0) {
        row[property.propertyCode] = "NA";
        return;
      }

      const history = [...record.history]
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .map((h) => {
          const date = new Date(h.completedDate)
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
            .replace(/ /g, " ");

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
const updateHousekeepingData = asyncHandler(async (req, res) => {
  const { updates } = req.body;

  //console.log("Payload:", JSON.stringify(req.body, null, 2));
  // console.log("User:", req.user);
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
                    updatedBy: req.user?._id || null,
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

  //console.log("Operations:", JSON.stringify(operations, null, 2));
  if (operations.length) {
    //console.log("Operations:", JSON.stringify(operations, null, 2));
    const result = await HousekeepingRecord.bulkWrite(operations);

    // console.log(result);
    const docs = await HousekeepingRecord.find().populate(
      "activityId propertyId",
    );

    //console.log(JSON.stringify(docs, null, 2));
  }

  res.status(200).json({
    success: true,
    message: "Housekeeping updated successfully.",
  });
});
// const updateHousekeepingData = asyncHandler(async (req, res) => {
//   const { updates } = req.body;

//   //console.log("Payload:", JSON.stringify(req.body, null, 2));
//   // console.log("User:", req.user);
//   if (!updates?.length) {
//     return res.status(400).json({
//       success: false,
//       message: "Updates are required",
//     });
//   }
//   const activities = await HousekeepingActivity.find({
//     isActive: true,
//   }).sort({ displayOrder: 1 });

//   const properties = await Property.find({}, { propertyCode: 1 });

//   // Property Map
//   const propertyMap = new Map();
//   properties.forEach((p) => {
//     propertyMap.set(p.propertyCode, p);
//   });

//   const operations = [];

//   for (const update of updates) {
//     const activity = activities[update.rowIndex];
//     console.log("Activity:", activity);
//     if (!activity) continue;

//     for (const column of update.columns) {
//       const property = propertyMap.get(column.columnName);
//       console.log("Property:", property);
//       console.log("Column:", column);

//       if (!property) continue;

//       operations.push({
//         updateOne: {
//           filter: {
//             propertyId: property._id,
//             activityId: activity._id,
//           },
//           update: {
//             $push: {
//               history: {
//                 $each: [
//                   {
//                     completedDate: new Date(column.value),
//                     completedAt: new Date(),
//                     updatedBy: req.user?._id || null,
//                     updatedByName: column.name || req.user?.name || "unknown",
//                     remarks: "",
//                     attachments: [],
//                   },
//                 ],
//                 $position: 0,
//                 $slice: 40,
//               },
//             },
//           },
//           upsert: true,
//         },
//       });
//     }
//   }

//   console.log("Operations:", JSON.stringify(operations, null, 2));
//   if (operations.length) {
//     //console.log("Operations:", JSON.stringify(operations, null, 2));
//     const result = await HousekeepingRecord.bulkWrite(operations);

//     console.log(result);
//     const docs = await HousekeepingRecord.find().populate(
//       "activityId propertyId",
//     );

//     console.log(JSON.stringify(docs, null, 2));
//   }

//   res.status(200).json({
//     success: true,
//     message: "Housekeeping updated successfully.",
//   });
// });
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
  fetchHousekeepingData,
  updateHousekeepingData,
};