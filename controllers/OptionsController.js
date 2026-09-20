const OptionsData = require("../models/options.model");
const { generateWorkLogs, createWorkLog } = require("../utils/worklog");
/**
 * @desc    Get all master categories
 * @route   GET /api/master-data
 */
exports.getAllOptionsData = async (req, res) => {
  try {
    // ================= Pagination =================
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    // ================= Query =================
    const query = {};

    // Category Filter
    if (req.query.categoryKey?.trim()) {
      query.categoryKey = req.query.categoryKey.trim().toLowerCase();
    }

    // ================= Global Search =================
    if (req.query.search?.trim()) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");

      query.$or = [
        { categoryKey: searchRegex },
        { categoryName: searchRegex },
        { label: searchRegex },
        { value: searchRegex },
        { code: searchRegex },
        { description: searchRegex },
      ];
    }

    // ================= Database Calls =================
    const [optionsData, total] = await Promise.all([
      OptionsData.find(query)
        .sort({ categoryName: 1, displayOrder: 1 })
        .skip(skip)
        .limit(limit),

      OptionsData.countDocuments(query),
    ]);
    res.status(200).json({
      success: true,
      page,
      limit,
      totalRecords: total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
      count: optionsData.length,
      data: optionsData,
    });
  } catch (error) {
    console.error("Get Master Data Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch master data.",
    });
  }
};
// exports.getAllOptionsData = async (req, res) => {
//   try {
//     const { categoryKey } = req.query;

//     const filter = {};

//     if (categoryKey) {
//       filter.categoryKey = categoryKey.toLowerCase();
//     }

//     const OptionsData = await OptionsData.find(filter).sort({
//       categoryName: 1,
//     });

//     return res.status(200).json({
//       success: true,
//       count: OptionsData.length,
//       data: OptionsData,
//     });
//   } catch (error) {
//     console.error("Get Master Data Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch master data.",
//     });
//   }
// };

/**
 * @desc    Get single master category
 * @route   GET /api/master-data/:id
 */
exports.getOptionsDataById = async (req, res) => {
  try {
    const master = await OptionsData.findById(req.params.id);

    if (!master) {
      return res.status(404).json({
        success: false,
        message: "Master category not found.",
      });
    }
    const data = master.toObject();
    data.items.sort((a, b) => b.displayOrder - a.displayOrder);
    return res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Get Master Data By Id:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch master category.",
    });
  }
};
/**
 * @desc    Create master category
 * @route   POST /api/master-data
 */
exports.createOptionsData = async (req, res) => {
  try {
    const { categoryKey, categoryName, description, items } = req.body;

    const exists = await OptionsData.findOne({
      categoryKey: categoryKey.toLowerCase(),
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Category already exists.",
      });
    }

    // Prevent duplicate values inside same category
    const values = items.map((item) => item.value.toLowerCase());

    if (new Set(values).size !== values.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate values found in items.",
      });
    }
    // ============================================================
    // WORKLOG USER
    // ============================================================
    // Get the logged-in user's display name from the request.
    // This follows the same approach used in Property worklogs.
    const user = req.body.createdByName || req.body.updatedByName || "System";
    const master = await OptionsData.create({
      categoryKey,
      categoryName,
      description,
      items,
    });
    // ============================================================
    // CREATION WORKLOG
    // ============================================================
    // Add one worklog when the master category is created.
    master.workLogs.push(
      createWorkLog({
        message: `Options category created by ${user}`,
        createdBy: user,
      }),
    );

    await master.save();
    return res.status(201).json({
      success: true,
      message: "created successfully.",
      data: master,
    });
  } catch (error) {
    console.error("Create Master Data:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create master category.",
    });
  }
};

/**
 * @desc    Update master category
 * @route   PUT /api/master-data/:id
 */
// exports.updateOptionsData = async (req, res) => {
//   try {
//     const { categoryName, description, items, newWorkLog } = req.body;
//     const master = await OptionsData.findByIdAndUpdate(
//       req.params.id,
//       {
//         categoryName,
//         description,
//         items,
//       },
//       {
//         new: true,
//         runValidators: true,
//       },
//     );

//     if (!master) {
//       return res.status(404).json({
//         success: false,
//         message: "Master category not found.",
//       });
//     }
//     // Prevent duplicate values inside items
//     const values = items.map((item) => item.value.trim().toLowerCase());

//     const duplicateValue = values.find(
//       (value, index) => values.indexOf(value) !== index,
//     );

//     if (duplicateValue) {
//       return res.status(400).json({
//         success: false,
//         message: `The item "${duplicateValue}" has been entered more than once. Please remove the duplicate and try again.`,
//       });
//     }

//     // ============================================================
//     // WORKLOG USER
//     // ============================================================
//     const user = req.body.updatedByName || req.body.createdByName || "System";

//     // Keep the existing worklogs before updating the document.
//     let workLogs = master.workLogs || [];
//     // ============================================================
//     // AUTOMATIC WORKLOG FOR CHANGED FIELDS
//     // ============================================================
//     const automaticWorkLogs = generateWorkLogs({
//       oldData: master.toObject(),

//       newData: {
//         categoryName,
//         description,
//         items,
//       },

//       createdBy: user,

//       ignoredFields: [
//         "newWorkLog",
//         "workLogs",

//         // MongoDB/system fields
//         "_id",
//         "__v",
//         "createdAt",
//         "updatedAt",

//         // User/helper fields
//         "createdByName",
//         "updatedByName",
//       ],
//     });

//     workLogs.push(...automaticWorkLogs);
//     // ============================================================
//     // MANUAL WORKLOG
//     // ============================================================
//     const manualWorkLog = String(newWorkLog || "").trim();

//     if (manualWorkLog) {
//       workLogs.push(
//         createWorkLog({
//           message: manualWorkLog,
//           createdBy: user,
//         }),
//       );
//     }

//     return res.status(200).json({
//       success: true,
//       message: "updated successfully.",
//       data: master,
//     });
//   } catch (error) {
//     console.error("Update Master Data:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to update master category.",
//     });
//   }
// };

exports.updateOptionsData = async (req, res) => {
  try {
    const { categoryName, description, items, newWorkLog } = req.body;

    // ============================================================
    // WORKLOG USER
    // ============================================================
    // Use the same user-name pattern as Salary worklogs.
    const user = req.body.updatedByName || req.body.createdByName || "System";

    // ============================================================
    // FIND EXISTING MASTER
    // ============================================================
    // IMPORTANT:
    // Fetch the existing document BEFORE changing anything.
    // generateWorkLogs() needs this OLD data for comparison.
    const master = await OptionsData.findById(req.params.id);

    if (!master) {
      return res.status(404).json({
        success: false,
        message: "Master category not found.",
      });
    }

    // ============================================================
    // PREVENT DUPLICATE VALUES
    // ============================================================
    const values = (items || []).map((item) =>
      String(item?.value || "")
        .trim()
        .toLowerCase(),
    );

    const duplicateValue = values.find(
      (value, index) => values.indexOf(value) !== index,
    );

    if (duplicateValue) {
      return res.status(400).json({
        success: false,
        message: `The item "${duplicateValue}" has been entered more than once. Please remove the duplicate and try again.`,
      });
    }

    // ============================================================
    // KEEP EXISTING WORKLOGS
    // ============================================================
    let workLogs = master.workLogs || [];

    // ============================================================
    // AUTOMATIC WORKLOGS
    // ============================================================
    const automaticWorkLogs = generateWorkLogs({
      // IMPORTANT:
      // This is the document BEFORE update.
      oldData: master.toObject(),

      // IMPORTANT:
      // Pass the final values that will actually be saved.
      newData: {
        // categoryKey is not editable from the frontend.
        // Keeping the old value prevents:
        // "Category Key changed from department to Blank"
        categoryKey: master.categoryKey,

        categoryName,
        description,
      },

      createdBy: user,

      ignoredFields: [
        // Worklog/helper fields
        "newWorkLog",
        "workLogs",
        "items",
        // MongoDB/system fields
        "_id",
        "__v",
        "createdAt",
        "updatedAt",

        // Frontend helper fields
        "createdByName",
        "updatedByName",
      ],
    });

    // Add all automatically generated change logs.
    workLogs.push(...automaticWorkLogs);
    // ============================================================
    // ITEM-LEVEL WORKLOGS
    // ============================================================
    // IMPORTANT:
    // Do not log the complete items array.
    // Compare each item using its MongoDB _id so that only the
    // actual changed item/field is recorded in the worklog.

    const oldItems = master.items || [];
    const newItems = items || [];

    // ------------------------------------------------------------
    // Compare existing items
    // ------------------------------------------------------------
    for (const newItem of newItems) {
      const oldItem = oldItems.find(
        (item) => String(item._id) === String(newItem._id),
      );

      // New item
      if (!oldItem) {
        workLogs.push(
          createWorkLog({
            message: `Item "${newItem.label || newItem.value}" was added.`,
            createdBy: user,
          }),
        );

        continue;
      }

      const itemName = oldItem.label || oldItem.value || "Item";

      // Compare only editable item fields
      const itemFields = [
        "label",
        "value",
        "code",
        "displayOrder",
        "isDefault",
        "isActive",
      ];

      for (const field of itemFields) {
        const oldValue = oldItem[field];
        const newValue = newItem[field];

        if (String(oldValue ?? "") !== String(newValue ?? "")) {
          workLogs.push(
            createWorkLog({
              message: `${field} of item "${itemName}" changed from "${oldValue ?? ""}" to "${newValue ?? ""}".`,
              createdBy: user,
            }),
          );
        }
      }
    }

    // ============================================================
    // DETECT DELETED ITEMS
    // ============================================================
    // Compare old items against the final items coming from frontend.
    // If an old item's _id is not present in the new items array,
    // that item has been deleted.

    for (const oldItem of oldItems) {
      const oldItemId = String(oldItem._id);

      const exists = newItems.some(
        (newItem) => newItem?._id && String(newItem._id) === oldItemId,
      );

      if (!exists) {
        workLogs.push(
          createWorkLog({
            message: `Item "${oldItem.label || oldItem.value}" was deleted.`,
            createdBy: user,
          }),
        );
      }
    }
    // ============================================================
    // MANUAL WORKLOG
    // ============================================================
    const manualWorkLog = String(newWorkLog || "").trim();

    if (manualWorkLog) {
      workLogs.push(
        createWorkLog({
          message: manualWorkLog,
          createdBy: user,
        }),
      );
    }

    // ============================================================
    // UPDATE MASTER
    // ============================================================
    master.categoryName = categoryName;
    master.description = description;
    master.items = items;

    // IMPORTANT:
    // Save both automatic and manually added worklogs.
    master.workLogs = workLogs;

    // ============================================================
    // SAVE
    // ============================================================
    await master.save();

    // ============================================================
    // RESPONSE
    // ============================================================
    return res.status(200).json({
      success: true,
      message: "updated successfully.",
      data: master,
    });
  } catch (error) {
    console.error("Update Master Data:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update master category.",
    });
  }
};
/**
 * @desc    Delete master data
 * @route   DELETE /api/master-data/:id
 */
exports.deleteOptionsData = async (req, res) => {
  try {
    const master = await OptionsData.findByIdAndDelete(req.params.id);

    if (!master) {
      return res.status(404).json({
        success: false,
        message: "Master data not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Master data deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete master data.",
    });
  }
};

exports.getOptionsDataByCategory = async (req, res) => {
  try {
    const { categoryKey } = req.params;

    const OptionsData = await OptionsData.find({
      categoryKey: categoryKey.toLowerCase(),
      isActive: true,
    })
      .sort({ displayOrder: 1 })
      .select("label value code");

    return res.status(200).json({
      success: true,
      count: OptionsData.length,
      data: OptionsData,
    });
  } catch (error) {
    console.error("Get Master Data By Category:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch master data.",
    });
  }
};

exports.getBatchOptions = async (req, res) => {
  try {
    const { categories } = req.query;

    if (!categories) {
      return res.status(400).json({
        success: false,
        message: "Categories are required.",
      });
    }

    const categoryList = categories
      .split(",")
      .map((item) => item.trim().toLowerCase());

    const options = await OptionsData.find({
      categoryKey: { $in: categoryList },
    }).select("categoryKey items");

    const result = {};

    options.forEach((category) => {
      result[category.categoryKey] = category.items
        .filter((item) => item.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((item) => ({
          label: item.label,
          value: item.value,
          id: item._id,
        }));
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get Batch Options Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch options.",
    });
  }
};