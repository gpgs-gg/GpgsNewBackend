const Property = require("../models/property.model");

const HousekeepingRecord = require("../models/housekeepingRecord.model");
const OptionsData = require("../models/options.model");
const asyncHandler = require("../middleware/asyncHandler");

const fetchHousekeepingData = asyncHandler(async (req, res) => {
  // 1. Fetch master data in parallel
  const [master, notificationMaster, properties, records] = await Promise.all([
    OptionsData.findOne({
      categoryKey: "housekeppingactivities",
    }).lean(),

    OptionsData.findOne({
      categoryKey: "housekeepingnotification",
    }).lean(),

    Property.find({ status: "Active" }, { propertyCode: 1 })
      .sort({ propertyCode: 1 })
      .lean(),

    HousekeepingRecord.find()
      .select("propertyId activityId history")
      .populate("history.updatedBy", "name")
      .lean(),
  ]);

  // 2. Validate master data
  if (!master) {
    return res.status(404).json({
      success: false,
      message: "Housekeeping master data not found.",
    });
  }

  // 3. Build notification lookup
  const notificationMap = new Map();

  notificationMaster?.items
    ?.filter((item) => item.isActive)
    .forEach((item) => {
      notificationMap.set(
        item.label.trim().toLowerCase(),
        Number(item.value) || 0,
      );
    });

  // 4. Prepare activities
  const activities = master.items
    .filter((item) => item.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((item) => ({
      activityId: item._id.toString(),
      activityName: item.label,
      frequency: Number(item.value),
      notifyBefore: notificationMap.get(item.label.trim().toLowerCase()) ?? 0,
    }));

  // 5. Index records once: propertyId + activityId
  const recordMap = new Map();

  for (const record of records) {
    if (!record.propertyId || !record.activityId) continue;

    const propertyId = record.propertyId.toString();
    const activityId = record.activityId.toString();

    const key = `${propertyId}_${activityId}`;

    // Preserve the previous find() behavior if duplicate records exist.
    if (!recordMap.has(key)) {
      recordMap.set(key, record);
    }
  }

  // 6. Prepare property IDs once
  const propertyList = properties.map((property) => ({
    id: property._id.toString(),
    code: property.propertyCode,
  }));

  // 7. Build headers
  const headers = [
    "SrNo",
    "Activities",
    "Freq",
    "Notify",
    ...properties.map((property) => ({
      title: property.propertyCode,
      propertyId: property._id,
    })),
  ];

  // 8. Build rows
  const data = activities.map((activity, index) => {
    const row = {
      SrNo: index + 1,
      activityId: activity.activityId,
      Activities: activity.activityName,
      Freq: activity.frequency,
      Notify: activity.notifyBefore,
    };

    for (const property of propertyList) {
      const key = `${property.id}_${activity.activityId}`;
      const record = recordMap.get(key);

      if (!record || !record.history?.length) {
        row[property.code] = "NA";
        continue;
      }

      // Sort once for this record and retain existing history format.
      const history = [...record.history]
        .sort(
          (a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0),
        )
        .map((item) => {
          const date = new Date(item.completedDate)
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
            .replace(/ /g, " ");

          const completedAt = new Date(item.completedAt).toLocaleString(
            "en-IN",
            { hour12: false },
          );

          const updatedBy =
            item.updatedByName || item.updatedBy?.name || "Unknown";

          return `${date}_[${completedAt} - ${updatedBy}]`;
        });

      row[property.code] = history.join("$") + "$";
    }

    return row;
  });

  return res.status(200).json({
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