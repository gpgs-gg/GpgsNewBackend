const OptionsData = require("../models/options.model");

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

    return res.status(200).json({
      success: true,
      data: optionsData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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

    return res.status(200).json({
      success: true,
      data: master,
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

    const master = await OptionsData.create({
      categoryKey,
      categoryName,
      description,
      items,
    });

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
exports.updateOptionsData = async (req, res) => {
  try {
    const { categoryName, description, items } = req.body;

// Prevent duplicate values inside items
const values = items.map((item) => item.value.trim().toLowerCase());

const duplicateValue = values.find(
  (value, index) => values.indexOf(value) !== index
);

if (duplicateValue) {
  return res.status(400).json({
    success: false,
    message: `The item "${duplicateValue}" has been entered more than once. Please remove the duplicate and try again.`,
  });
}

    const master = await OptionsData.findByIdAndUpdate(
      req.params.id,
      {
        categoryName,
        description,
        items,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!master) {
      return res.status(404).json({
        success: false,
        message: "Master category not found.",
      });
    }

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