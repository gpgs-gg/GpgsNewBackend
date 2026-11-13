const mongoose = require("mongoose");
const PropertyExpense = require("../models/propertyExpense.model");
const {
  AC1Transaction,
  AC2Transaction,
  AC3Transaction,
  AC4Transaction,
  AC5Transaction,
} = require("../models/bankTranscation.model");
const OptionsData = require("../models/options.model");


//  const expenseCategory = [
//   "Petrol",
//   "Snacks",
//   "EB",
//   "Stationary",
//   "2 Wheeler Repair",
//   "Salary",
//   "Monthly Expense",
//   "New Setup Expense",
//   "Office Expense",
//   "Asset Expense",
//   "Inventory Expense",
//   "Client Rent",
//   "Marketing Expenses",
//   "Household Items",
//   "Bank Srvc Charges",
//   "HR Expenses",
//   "2 Wheeler Insurance",
//   "Festival Expenses",
//   "KK Self",
//   "Other Expenses",
//   "Shop1 Rent",
//   "Pest Control",
//   "Property Owner Rent",
//   "New Booking",
//   "FNF",
//   "Owner Expense",
//   "Approx EB Refund",
//   "DMart",
//   "Cash Box",
//   "Medical Expense",
//   "Mahanagar Gas",
//   "GPGS Expenses Fund",
//   "AV209&210Satara_HS Booking",
//   "GPMS",
//   "GPGS - New Plywoods",
//   "GPGS - New LED Patti",
//   "GPGS - New LED Bulbs",
//   "GPGS - Buttons 6A",
//   "GPGS - Buttons 16A",
//   "Maintenance",
//   "PUC",
//   "Office Expenses",
//   "Insurance",
//   "HouseKeeping Material",
//   "Marketing",
//   "Stamp Papers",
//   "Revenue Stamps",
//   "Social Work",
//   "GPGS - Exhaust Fans",
//   "GPGS - Ceiling Fans",
//   "Inventory",
//   "Assets",
//   "Domain charges",
//   "Plastic Net",
//   "Pegion Net",
//   "Birds Net",
//   "EMI TataACE 5449",
//   "EMI RH10ALONL21",
//   "Key",
//   "Wifi Recharge",
//   "LPG Cylinder",
// ];

const expenseCategory = [
  "Monthly Expense",
  "New Setup Expense",
  "Office Expense",
  "Asset Expense",
  "Inventory Expense",

  "Marketing Expenses",
  "Household Items",
  "Bank Srvc Charges",
  "HR Expenses",

  "Festival Expenses",
  "KK Self",
  "Other Expenses",
  "Shop1 Rent",
  "Pest Control",
  "Property Owner Rent",
  // "FNF",
  "Owner Expense",
  "DMart",
  "Cash Box",
  "Medical Expense",
  "Mahanagar Gas",
  "GPGS Expenses Fund",
  "AV209&210Satara_HS Booking",
  "GPMS",
  "GPGS - New Plywoods",
  "GPGS - New LED Patti",
  "GPGS - New LED Bulbs",
  "GPGS - Buttons 6A",
  "GPGS - Buttons 16A",
  "Maintenance",
  "PUC",
  "Office Expenses",
  "Insurance",
  "HouseKeeping Material",
  "Marketing",
  "Stamp Papers",
  "Revenue Stamps",
  "Social Work",
  "GPGS - Exhaust Fans",
  "GPGS - Ceiling Fans",
  "Inventory",
  "Assets",
  "Domain charges",
  "Plastic Net",
  "Pegion Net",
  "Birds Net",
  "EMI TataACE 5449",
  "EMI RH10ALONL21",
  "Key",
  "Wifi Recharge",
  "LPG Cylinder",
];



const Property = require("../models/property.model");
const { createWorkLog, generateWorkLogs } = require("../utils/worklog");

const PAYMENT_MODES = ["Cash", "Bank", "UPI", "Cheque", "Other"];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const getProperty = async (propertyId) => {
  if (!isValidId(propertyId)) return null;

  // If your Property model uses a different filename,
  // change the import above to match your project.
  return Property.findById(propertyId).lean();
};

const buildFilters = (query) => {
  const filter = {};

  if (query.propertyId) {
    if (!isValidId(query.propertyId)) {
      const error = new Error("Invalid property ID");
      error.statusCode = 400;
      throw error;
    }

    filter.propertyId = new mongoose.Types.ObjectId(query.propertyId);
  }

  // if (query.category) {
  //   if (!CATEGORIES.includes(query.category)) {
  //     const error = new Error("Invalid expense category");
  //     error.statusCode = 400;
  //     throw error;
  //   }

  //   filter.category = query.category;
  // }

  if (query.fromDate || query.toDate) {
    filter.expenseDate = {};

    if (query.fromDate) {
      const from = new Date(`${query.fromDate}T00:00:00.000Z`);

      if (Number.isNaN(from.getTime())) {
        const error = new Error("Invalid fromDate");
        error.statusCode = 400;
        throw error;
      }

      filter.expenseDate.$gte = from;
    }

    if (query.toDate) {
      const to = new Date(`${query.toDate}T23:59:59.999Z`);

      if (Number.isNaN(to.getTime())) {
        const error = new Error("Invalid toDate");
        error.statusCode = 400;
        throw error;
      }

      filter.expenseDate.$lte = to;
    }
  }

  return filter;
};

const validateBody = (body) => {
  const {
    propertyId,
    expenseDate,
    category,
    amount,
    paymentMode,
    comment,
    description,
    receiptUrl,
    newSetUp,
  } = body;

  if (!propertyId || !isValidId(propertyId)) {
    return "Please select a valid property";
  }

  if (!expenseDate || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
    return "Valid expense date is required (YYYY-MM-DD)";
  }

  const parsedDate = new Date(`${expenseDate}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== expenseDate
  ) {
    return "Invalid expense date";
  }

  // if (!CATEGORIES.includes(category)) {
  //   return "Valid expense category is required";
  // }

  if (
    amount === "" ||
    amount === null ||
    amount === undefined ||
    !Number.isFinite(Number(amount)) ||
    Number(amount) < 0
  ) {
    return "Amount must be a valid non-negative number";
  }

  if (paymentMode && !PAYMENT_MODES.includes(paymentMode)) {
    return "Invalid payment mode";
  }

  if (description !== undefined && typeof description !== "string") {
    return "Description must be text";
  }

  if (receiptUrl !== undefined && typeof receiptUrl !== "string") {
    return "Receipt URL must be text";
  }

  return null;
};

// GET /api/property-expenses
exports.getExpenses = async (req, res) => {
  try {
    const filter = buildFilters(req.query);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [data, stats] = await Promise.all([
      PropertyExpense.find(filter)
        .sort({ expenseDate: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate("propertyId", "propertyCode propertyLocation")
        .lean(),

      PropertyExpense.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            totalRecords: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summary = stats[0] || {
      totalAmount: 0,
      totalRecords: 0,
    };

    return res.json({
      success: true,
      data,
      page,
      limit,
      totalRecords: summary.totalRecords,
      totalPages: Math.ceil(summary.totalRecords / limit),
      totalAmount: summary.totalAmount,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch expenses",
    });
  }
};

// POST /api/property-expenses
// exports.createExpense = async (req, res) => {
//   try {
//     console.log("Authenticated user:", req.user);
//     console.log("User ID (_id):", req.user?._id);
//     console.log("User ID (id):", req.user?.id);
//     const validationError = validateBody(req.body);

//     if (validationError) {
//       return res.status(400).json({
//         success: false,
//         message: validationError,
//       });
//     }

//     const property = await getProperty(req.body.propertyId);

//     if (!property) {
//       return res.status(404).json({
//         success: false,
//         message: "Property not found",
//       });
//     }

//  const expense = await PropertyExpense.create({
//   propertyId: property._id,
//   propertyCodeSnapshot: property.propertyCode || "",
//   expenseDate: new Date(`${req.body.expenseDate}T00:00:00.000Z`),
//   category: req.body.category,
//   amount: Number(req.body.amount),
//   paymentMode: req.body.paymentMode || "Bank",
//   description: req.body.description || "",
//   receiptUrl: req.body.receiptUrl || "",

//   // Store the logged-in user's name
//   createdBy: req.user?.name || null,

//   // Keep the user ID for updatedBy
//   updatedBy: req.user?._id || req.user?.id || null,
// });

//     return res.status(201).json({
//       success: true,
//       message: "Expense added successfully",
//       data: expense,
//     });
//   } catch (error) {
//     return res.status(error.statusCode || 500).json({
//       success: false,
//       message: error.message || "Failed to add expense",
//     });
//   }
// };

exports.createExpense = async (req, res) => {
  try {
    const validationError = validateBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const property = await getProperty(req.body.propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const user =
      req.user?.name ||
      req.body.createdByName ||
      req.body.updatedByName ||
      "System";

    const expense = await PropertyExpense.create({
      propertyId: property._id,
      propertyCodeSnapshot: property.propertyCode || "",
      expenseDate: new Date(`${req.body.expenseDate}T00:00:00.000Z`),
      category: req.body.category,
      amount: Number(req.body.amount),
      paymentMode: req.body.paymentMode || "Bank",
      description: req.body.description || "",
      comment: req.body.comment || "",
      newSetUp: req.body.newSetUp ?? false,
      createdBy: user,
      updatedBy: req.user?._id || req.user?.id || null,

      workLogs: [
        createWorkLog({
          message: `Expense created by ${user}`,
          createdBy: user,
        }),
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Expense added successfully",
      data: expense,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to add expense",
    });
  }
};

// PUT /api/property-expenses/:id
// exports.updateExpense = async (req, res) => {
//   try {
//     if (!isValidId(req.params.id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid expense ID",
//       });
//     }

//     const validationError = validateBody(req.body);

//     if (validationError) {
//       return res.status(400).json({
//         success: false,
//         message: validationError,
//       });
//     }

//     const property = await getProperty(req.body.propertyId);

//     if (!property) {
//       return res.status(404).json({
//         success: false,
//         message: "Property not found",
//       });
//     }

//     const expense = await PropertyExpense.findByIdAndUpdate(
//       req.params.id,
//       {
//         propertyId: property._id,
//         propertyCodeSnapshot: property.propertyCode || "",
//         expenseDate: new Date(`${req.body.expenseDate}T00:00:00.000Z`),
//         category: req.body.category,
//         amount: Number(req.body.amount),
//         paymentMode: req.body.paymentMode || "Bank",
//         description: req.body.description || "",
//         receiptUrl: req.body.receiptUrl || "",
//         updatedBy: req.user?._id || null,
//       },
//       { new: true, runValidators: true },
//     );

//     if (!expense) {
//       return res.status(404).json({
//         success: false,
//         message: "Expense not found",
//       });
//     }

//     return res.json({
//       success: true,
//       message: "Expense updated successfully",
//       data: expense,
//     });
//   } catch (error) {
//     return res.status(error.statusCode || 500).json({
//       success: false,
//       message: error.message || "Failed to update expense",
//     });
//   }
// };

exports.updateExpense = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const validationError = validateBody(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const expense = await PropertyExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    const property = await getProperty(req.body.propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const user =
      req.user?.name ||
      req.body.updatedByName ||
      req.body.createdByName ||
      "System";

    const newExpenseData = {
      propertyId: property._id,
      propertyCodeSnapshot: property.propertyCode || "",
      expenseDate: new Date(`${req.body.expenseDate}T00:00:00.000Z`),
      category: req.body.category,
      amount: Number(req.body.amount),
      paymentMode: req.body.paymentMode || "Bank",
      description: req.body.description || "",
      comment: req.body.comment || "",
      newSetUp: req.body.newSetUp ?? false,
    };

    // Generate worklogs for changed fields only.
    const automaticWorkLogs = generateWorkLogs({
      oldData: expense.toObject(),
      newData: newExpenseData,
      createdBy: user,
      ignoredFields: [
        "_id",
        "createdAt",
        "updatedAt",
        "__v",
        "createdBy",
        "updatedBy",
        "workLogs",
      ],
    });

    // Keep previous logs and append new logs.
    expense.workLogs = [...(expense.workLogs || []), ...automaticWorkLogs];

    // Update expense fields.
    Object.assign(expense, newExpenseData);

    expense.updatedBy = req.user?._id || req.user?.id || expense.updatedBy;

    await expense.save();

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update expense",
    });
  }
};

// DELETE /api/property-expenses/:id
exports.deleteExpense = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense = await PropertyExpense.findByIdAndDelete(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    return res.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete expense",
    });
  }
};

// GET /api/property-expenses/summary
exports.getExpenseSummary = async (req, res) => {
  try {
    const filter = buildFilters(req.query);

    const data = await PropertyExpense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$category",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const totalAmount = data.reduce((sum, item) => sum + item.totalAmount, 0);

    return res.json({
      success: true,
      data,
      totalAmount,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch expense summary",
    });
  }
};

// GET /api/property-expenses/property/:propertyId
exports.getExpensesByPropertyId = async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID",
      });
    }

    const property = await Property.findById(propertyId).lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

    const filter = {
      propertyId: new mongoose.Types.ObjectId(propertyId),
    };

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.fromDate || req.query.toDate) {
      filter.expenseDate = {};

      if (req.query.fromDate) {
        const from = new Date(`${req.query.fromDate}T00:00:00.000Z`);

        if (
          Number.isNaN(from.getTime()) ||
          from.toISOString().slice(0, 10) !== req.query.fromDate
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid fromDate",
          });
        }

        filter.expenseDate.$gte = from;
      }

      if (req.query.toDate) {
        const to = new Date(`${req.query.toDate}T23:59:59.999Z`);

        if (
          Number.isNaN(to.getTime()) ||
          to.toISOString().slice(0, 10) !== req.query.toDate
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid toDate",
          });
        }

        filter.expenseDate.$lte = to;
      }
    }

    if (
      filter.expenseDate?.$gte &&
      filter.expenseDate?.$lte &&
      filter.expenseDate.$gte > filter.expenseDate.$lte
    ) {
      return res.status(400).json({
        success: false,
        message: "fromDate cannot be after toDate",
      });
    }

    const skip = (page - 1) * limit;

    const [expenses, countResult, categorySummary] = await Promise.all([
      PropertyExpense.find(filter)
        .sort({ expenseDate: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      PropertyExpense.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            totalRecords: { $sum: 1 },
          },
        },
      ]),

      PropertyExpense.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$category",
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
    ]);

    const summary = countResult[0] || {
      totalAmount: 0,
      totalRecords: 0,
    };

    return res.status(200).json({
      success: true,
      property: {
        _id: property._id,
        propertyCode: property.propertyCode || "",
        propertyLocation: property.propertyLocation || "",
      },
      summary: {
        totalExpenses: summary.totalAmount,
        totalRecords: summary.totalRecords,
        categorySummary,
      },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(summary.totalRecords / limit),
      },
      data: expenses,
    });
  } catch (error) {
    console.error("getExpensesByPropertyId:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch property expenses",
    });
  }
};
// get all bank transaction by propetyid
exports.getBankTransactionsByPropertyId = async (req, res) => {
  try {
    // =========================================================
    // PROPERTY VALIDATION
    // =========================================================

    const { propertyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID",
      });
    }

    const propertyObjectId = new mongoose.Types.ObjectId(propertyId);

    const property = await Property.findById(propertyObjectId)
      .select("propertyCode propertyLocation")
      .lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // =========================================================
    // PAGINATION
    // =========================================================

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(100, Math.max(parseInt(req.query.limit) || 10, 1));

    const skip = (page - 1) * limit;

    // =========================================================
    // BUILD QUERY
    // =========================================================

    // Always restrict transactions to the requested property.
    // =========================================================
    // BUILD QUERY - PROPERTY + EXPENSE CATEGORIES
    // =========================================================

    const query = {
      propertyId: propertyObjectId,

      expenseCategory: {
        $in: expenseCategory.map(
          (category) =>
            new RegExp(
              `^${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
              "i",
            ),
        ),
      },
    };

    // =========================================================
    // SEARCH
    // =========================================================

    if (req.query.search?.trim()) {
      const searchValue = req.query.search.trim();

      const escapedSearchValue = searchValue.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

      const regex = new RegExp(escapedSearchValue, "i");

      const searchConditions = [{ narration: regex }, { chqNo: regex }];

      // Search numeric amounts
      if (!isNaN(Number(searchValue))) {
        const amount = Number(searchValue);

        searchConditions.push({ withdrawal: amount }, { deposit: amount });
      }

      // Search Expense Code
      const matchingExpenseCodes = await OptionsData.find({
        categoryKey: "expensecode",
        "items.value": regex,
      })
        .select("items")
        .lean();

      const matchingExpenseCodeIds = matchingExpenseCodes.flatMap((option) =>
        (option.items || [])
          .filter(
            (item) =>
              regex.test(item.value || "") || regex.test(item.label || ""),
          )
          .map((item) => item._id),
      );

      if (matchingExpenseCodeIds.length > 0) {
        searchConditions.push({
          expenseCode: {
            $in: matchingExpenseCodeIds,
          },
        });
      }

      query.$or = searchConditions;
    }

    // =========================================================
    // TRANSACTION DATE
    // =========================================================

    if (req.query.fromDate || req.query.toDate) {
      query.date = {};

      if (req.query.fromDate) {
        const start = new Date(req.query.fromDate);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid fromDate",
          });
        }

        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }

      if (req.query.toDate) {
        const end = new Date(req.query.toDate);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid toDate",
          });
        }

        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }

      if (
        query.date.$gte &&
        query.date.$lte &&
        query.date.$gte > query.date.$lte
      ) {
        return res.status(400).json({
          success: false,
          message: "fromDate cannot be after toDate",
        });
      }
    }

    // =========================================================
    // VALUE DATE
    // =========================================================

    if (req.query.valueFromDate || req.query.valueToDate) {
      query.valueDate = {};

      if (req.query.valueFromDate) {
        const start = new Date(req.query.valueFromDate);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid valueFromDate",
          });
        }

        start.setHours(0, 0, 0, 0);
        query.valueDate.$gte = start;
      }

      if (req.query.valueToDate) {
        const end = new Date(req.query.valueToDate);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid valueToDate",
          });
        }

        end.setHours(23, 59, 59, 999);
        query.valueDate.$lte = end;
      }

      if (
        query.valueDate.$gte &&
        query.valueDate.$lte &&
        query.valueDate.$gte > query.valueDate.$lte
      ) {
        return res.status(400).json({
          success: false,
          message: "valueFromDate cannot be after valueToDate",
        });
      }
    }

    // =========================================================
    // EXPENSE CODE
    // =========================================================

    if (req.query.expenseCode) {
      const id = String(req.query.expenseCode).trim();

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid expenseCode",
        });
      }

      query.expenseCode = new mongoose.Types.ObjectId(id);
    }

    // =========================================================
    // BASIC FILTERS
    // =========================================================

    if (req.query.source) {
      query.source = req.query.source;
    }

    if (req.query.userId) {
      query.userId = req.query.userId;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    // =========================================================
    // ASSIGNEE
    // =========================================================

    if (req.query.assignee?.trim()) {
      const escaped = req.query.assignee
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      query.assignee = {
        $regex: escaped,
        $options: "i",
      };
    }

    // =========================================================
    // EXPENSE CATEGORY
    // =========================================================

    const expenseCategoryParam =
      req.query.expenseCategory ?? req.query["expenseCategory[]"];

    if (expenseCategoryParam) {
      const expenseCategories = Array.isArray(expenseCategoryParam)
        ? expenseCategoryParam
        : [expenseCategoryParam];

      const validCategories = expenseCategories
        .map((category) => String(category).trim())
        .filter(Boolean);

      if (validCategories.length > 0) {
        query.expenseCategory = {
          $in: validCategories.map(
            (category) =>
              new RegExp(
                `^${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                "i",
              ),
          ),
        };
      }
    }

    // =========================================================
    // CHEQUE NUMBER
    // =========================================================

    if (req.query.chqNo?.trim()) {
      const escaped = req.query.chqNo
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      query.chqNo = {
        $regex: escaped,
        $options: "i",
      };
    }

    // =========================================================
    // NARRATION / SALARY
    // =========================================================

    if (req.query.narration?.trim()) {
      const escaped = req.query.narration
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      query.narration = {
        $regex: escaped,
        $options: "i",
      };
    } else if (req.query.transactionType === "salary") {
      query.narration = {
        $regex: "salary",
        $options: "i",
      };
    } else {
      query.narration = {
        $not: /salary/i,
      };
    }

    // =========================================================
    // AMOUNT RANGE
    // =========================================================

    
    if (
      req.query.minAmount !== undefined ||
      req.query.maxAmount !== undefined
    ) {
      const min =
        req.query.minAmount !== undefined && req.query.minAmount !== ""
          ? Number(req.query.minAmount)
          : 0;

      const max =
        req.query.maxAmount !== undefined && req.query.maxAmount !== ""
          ? Number(req.query.maxAmount)
          : Number.MAX_SAFE_INTEGER;

      if (
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        min < 0 ||
        max < min
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid amount range",
        });
      }

      query.$and ??= [];

      query.$and.push({
        $or: [
          {
            withdrawal: {
              $gte: min,
              $lte: max,
            },
          },
          {
            deposit: {
              $gte: min,
              $lte: max,
            },
          },
        ],
      });
    }

    // =========================================================
    // TRANSACTION TYPE
    // =========================================================

    if (req.query.transactionType === "deposit") {
      query.deposit = {
        $gt: 0,
      };
    }

    if (req.query.transactionType === "withdrawal") {
      query.withdrawal = {
        $gt: 0,
      };
    }

    // =========================================================
    // ACCOUNTS
    // =========================================================

    const accounts = [
      { model: AC1Transaction, account: "AC1" },
      { model: AC2Transaction, account: "AC2" },
      { model: AC3Transaction, account: "AC3" },
      { model: AC4Transaction, account: "AC4" },
      { model: AC5Transaction, account: "AC5" },
    ];

    const selectedAccounts = req.query.account
      ? accounts.filter((account) => account.account === req.query.account)
      : accounts;

    // =========================================================
    // INVALID ACCOUNT
    // =========================================================

    if (selectedAccounts.length === 0) {
      return res.status(200).json({
        success: true,
        property: {
          _id: property._id,
          propertyCode: property.propertyCode || "",
          propertyLocation: property.propertyLocation || "",
        },
        page,
        limit,
        totalRecords: 0,
        totalPages: 0,
        availableAccounts: [],
        hasNextPage: false,
        hasPrevPage: page > 1,
        count: 0,
        data: [],
        totalDeposit: 0,
        totalWithdrawal: 0,
      });
    }

    // =========================================================
    // EXPENSE CODE OPTIONS
    // =========================================================

    const expenseCodeOptions = await OptionsData.findOne({
      categoryKey: "expensecode",
    })
      .select("items")
      .lean();

    const expenseCodeMap = new Map(
      (expenseCodeOptions?.items || []).map((item) => [
        String(item._id),
        {
          label: item.label,
          value: item.value,
          id: item._id,
        },
      ]),
    );

    // =========================================================
    // DATA AGGREGATION
    // =========================================================

    const candidateLimit = skip + limit;
    const firstAccount = selectedAccounts[0];

    const dataPipeline = [
      {
        $match: query,
      },
      {
        $sort: {
          createdAt: -1,
          _id: -1,
        },
      },
      {
        $limit: candidateLimit,
      },
      {
        $addFields: {
          account: firstAccount.account,
        },
      },
    ];

    // =========================================================
    // UNION OTHER ACCOUNTS
    // =========================================================

    for (let i = 1; i < selectedAccounts.length; i++) {
      const account = selectedAccounts[i];

      dataPipeline.push({
        $unionWith: {
          coll: account.model.collection.name,
          pipeline: [
            {
              $match: query,
            },
            {
              $sort: {
                createdAt: -1,
                _id: -1,
              },
            },
            {
              $limit: candidateLimit,
            },
            {
              $addFields: {
                account: account.account,
              },
            },
          ],
        },
      });
    }

    // =========================================================
    // GLOBAL SORT + PAGINATION
    // =========================================================

    dataPipeline.push(
      {
        $sort: {
          createdAt: -1,
          _id: -1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    );

    // =========================================================
    // USER LOOKUP
    // =========================================================

    dataPipeline.push({
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    });

    dataPipeline.push({
      $unwind: {
        path: "$user",
        preserveNullAndEmptyArrays: true,
      },
    });

    // =========================================================
    // PROPERTY LOOKUP
    // =========================================================

    dataPipeline.push({
      $lookup: {
        from: "properties",
        localField: "propertyId",
        foreignField: "_id",
        as: "property",
      },
    });

    dataPipeline.push({
      $unwind: {
        path: "$property",
        preserveNullAndEmptyArrays: true,
      },
    });

    // =========================================================
    // PROJECT
    // =========================================================

    dataPipeline.push({
      $project: {
        _id: 1,
        date: 1,
        narration: 1,
        chqNo: 1,
        withdrawal: 1,
        deposit: 1,
        balance: 1,
        valueDate: 1,

        source: 1,
        userId: 1,

        assignee: 1,
        reviewer: 1,
        auditor: 1,

        status: 1,
        expenseCategory: 1,
        expenseCode: 1,

        workLogs: 1,

        isMapped: 1,
        mappedAt: 1,
        clientId: 1,
        propertyId: 1,
        bedId: 1,

        metadata: 1,

        createdAt: 1,
        updatedAt: 1,

        account: 1,
        user: 1,
        property: 1,
      },
    });

    // =========================================================
    // EXACT TOTALS AGGREGATION
    // =========================================================

    const totalPromises = selectedAccounts.map(async ({ model, account }) => {
      const result = await model.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: null,

            count: {
              $sum: 1,
            },

            totalDeposit: {
              $sum: {
                $ifNull: ["$deposit", 0],
              },
            },

            totalWithdrawal: {
              $sum: {
                $ifNull: ["$withdrawal", 0],
              },
            },
          },
        },
      ]);

      const stats = result[0] || {};

      return {
        account,
        count: Number(stats.count || 0),
        totalDeposit: Number(stats.totalDeposit || 0),
        totalWithdrawal: Number(stats.totalWithdrawal || 0),
      };
    });

    // =========================================================
    // RUN DATA + TOTALS IN PARALLEL
    // =========================================================

    const [transactionsResult, accountTotals] = await Promise.all([
      firstAccount.model.aggregate(dataPipeline, {
        allowDiskUse: true,
      }),

      Promise.all(totalPromises),
    ]);

    // =========================================================
    // FORMAT TRANSACTIONS
    // =========================================================

    const transactions = (transactionsResult || []).map((transaction) => {
      const user = transaction.user;
      const populatedProperty = transaction.property;

      return {
        ...transaction,

        userId: transaction.userId
          ? {
              _id: transaction.userId,
              fullName: user?.fullName || "",
            }
          : null,

        propertyId: transaction.propertyId
          ? {
              _id: transaction.propertyId,
              propertyCode: populatedProperty?.propertyCode || "",
            }
          : null,

        expenseCode: transaction.expenseCode
          ? expenseCodeMap.get(String(transaction.expenseCode)) || null
          : null,

        user: undefined,
        property: undefined,
      };
    });

    // =========================================================
    // EXACT TOTALS
    // =========================================================

    let totalRecords = 0;
    let totalDeposit = 0;
    let totalWithdrawal = 0;

    const availableAccounts = [];

    for (const accountTotal of accountTotals) {
      totalRecords += accountTotal.count;
      totalDeposit += accountTotal.totalDeposit;
      totalWithdrawal += accountTotal.totalWithdrawal;

      if (accountTotal.count > 0) {
        availableAccounts.push(accountTotal.account);
      }
    }

    // =========================================================
    // PAGINATION INFO
    // =========================================================

    const totalPages = Math.ceil(totalRecords / limit);

    // =========================================================
    // RESPONSE
    // =========================================================

    return res.status(200).json({
      success: true,

      property: {
        _id: property._id,
        propertyCode: property.propertyCode || "",
        propertyLocation: property.propertyLocation || "",
      },

      page,
      limit,

      totalRecords,
      totalPages,

      availableAccounts,

      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,

      count: transactions.length,
      data: transactions,

      totalDeposit,
      totalWithdrawal,
    });
  } catch (error) {
    console.error("Get Bank Transactions By Property ID Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch property bank transactions",
      error: error.message,
    });
  }
};

//get all record bank transaction and exxpense by propertyid

exports.getPropertyExpensesWithBankTransactions = async (req, res) => {
  try {
    const { propertyId } = req.params;

    // =========================================================
    // PROPERTY VALIDATION
    // =========================================================

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID",
      });
    }

    const propertyObjectId = new mongoose.Types.ObjectId(propertyId);

    const property = await Property.findById(propertyObjectId)
      .select("propertyCode propertyLocation")
      .lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // =========================================================
    // PAGINATION
    // =========================================================

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    // Fetch enough records from each source before global pagination.
    const candidateLimit = skip + limit;

    // =========================================================
    // COMMON DATE VALIDATION
    // =========================================================

    const parseDateRange = (fromDate, toDate) => {
      const range = {};

      if (fromDate) {
        const start = new Date(`${fromDate}T00:00:00.000Z`);

        if (
          Number.isNaN(start.getTime()) ||
          start.toISOString().slice(0, 10) !== fromDate
        ) {
          throw new Error("Invalid fromDate");
        }

        range.$gte = start;
      }

      if (toDate) {
        const end = new Date(`${toDate}T23:59:59.999Z`);

        if (
          Number.isNaN(end.getTime()) ||
          end.toISOString().slice(0, 10) !== toDate
        ) {
          throw new Error("Invalid toDate");
        }

        range.$lte = end;
      }

      if (range.$gte && range.$lte && range.$gte > range.$lte) {
        throw new Error("fromDate cannot be after toDate");
      }

      return range;
    };

    // =========================================================
    // SEARCH
    // =========================================================

    const searchValue = String(req.query.search || "").trim();

    const escapedSearch = searchValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const searchRegex = new RegExp(escapedSearch, "i");

    // =========================================================
    // PROPERTY EXPENSE QUERY
    // =========================================================

    const propertyExpenseQuery = {
      propertyId: propertyObjectId,
    };

    // EXPENSE CATEGORY
    const expenseType = req.query.expenseCategory;

    if (expenseType) {
      propertyExpenseQuery.category = expenseType;
    }

    // DATE FILTER
    if (req.query.fromDate || req.query.toDate) {
      propertyExpenseQuery.expenseDate = parseDateRange(
        req.query.fromDate,
        req.query.toDate,
      );
    }

    // SEARCH FILTER
    if (searchValue) {
      const searchConditions = [
        { description: searchRegex },
        { category: searchRegex },
        { paymentMode: searchRegex },
        { propertyCodeSnapshot: searchRegex },
      ];

      if (!Number.isNaN(Number(searchValue))) {
        searchConditions.push({
          amount: Number(searchValue),
        });
      }

      propertyExpenseQuery.$or = searchConditions;
    }

    // =========================================================
    // BANK TRANSACTION QUERY
    // =========================================================

    const bankQuery = {
      propertyId: propertyObjectId,

      // Retain your existing bank transaction category restriction.
      expenseCategory: {
        $in: expenseCategory.map(
          (category) =>
            new RegExp(
              `^${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
              "i",
            ),
        ),
      },
    };

    // SEARCH
    if (searchValue) {
      const searchConditions = [
        { narration: searchRegex },
        { chqNo: searchRegex },
        { expenseCategory: searchRegex },
      ];

      if (!Number.isNaN(Number(searchValue))) {
        const amount = Number(searchValue);

        searchConditions.push({ withdrawal: amount }, { deposit: amount });
      }

      const matchingExpenseCodes = await OptionsData.find({
        categoryKey: "expensecode",
        "items.value": searchRegex,
      })
        .select("items")
        .lean();

      const matchingExpenseCodeIds = matchingExpenseCodes.flatMap((option) =>
        (option.items || [])
          .filter(
            (item) =>
              searchRegex.test(item.value || "") ||
              searchRegex.test(item.label || ""),
          )
          .map((item) => item._id),
      );

      if (matchingExpenseCodeIds.length) {
        searchConditions.push({
          expenseCode: {
            $in: matchingExpenseCodeIds,
          },
        });
      }

      bankQuery.$or = searchConditions;
    }

    // TRANSACTION DATE
    if (req.query.fromDate || req.query.toDate) {
      bankQuery.date = parseDateRange(req.query.fromDate, req.query.toDate);
    }

    // VALUE DATE
    if (req.query.valueFromDate || req.query.valueToDate) {
      bankQuery.valueDate = parseDateRange(
        req.query.valueFromDate,
        req.query.valueToDate,
      );
    }

    // EXPENSE CODE
    if (req.query.expenseCode) {
      const id = String(req.query.expenseCode).trim();

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid expenseCode",
        });
      }

      bankQuery.expenseCode = new mongoose.Types.ObjectId(id);
    }

    // BASIC FILTERS
    if (req.query.source) {
      bankQuery.source = req.query.source;
    }

    if (req.query.userId) {
      bankQuery.userId = req.query.userId;
    }

    if (req.query.status) {
      bankQuery.status = req.query.status;
    }

    // ASSIGNEE
    if (req.query.assignee?.trim()) {
      bankQuery.assignee = {
        $regex: req.query.assignee
          .trim()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    }

    // EXPENSE CATEGORY
    if (expenseType) {
      bankQuery.expenseCategory = {
        $in: [
          new RegExp(
            `^${expenseType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i",
          ),
        ],
      };
    }

    // CHEQUE NUMBER
    if (req.query.chqNo?.trim()) {
      bankQuery.chqNo = {
        $regex: req.query.chqNo.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    }

    // NARRATION / SALARY
    if (req.query.narration?.trim()) {
      bankQuery.narration = {
        $regex: req.query.narration
          .trim()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    } else if (req.query.transactionType === "salary") {
      bankQuery.narration = {
        $regex: "salary",
        $options: "i",
      };
    } else {
      bankQuery.narration = {
        $not: /salary/i,
      };
    }

    // AMOUNT RANGE
    if (
      req.query.minAmount !== undefined ||
      req.query.maxAmount !== undefined
    ) {
      const min =
        req.query.minAmount !== undefined && req.query.minAmount !== ""
          ? Number(req.query.minAmount)
          : 0;

      const max =
        req.query.maxAmount !== undefined && req.query.maxAmount !== ""
          ? Number(req.query.maxAmount)
          : Number.MAX_SAFE_INTEGER;

      if (
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        min < 0 ||
        max < min
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid amount range",
        });
      }

      bankQuery.$and ??= [];

      bankQuery.$and.push({
        $or: [
          {
            withdrawal: { $gte: min, $lte: max },
          },
          {
            deposit: { $gte: min, $lte: max },
          },
        ],
      });
    }

    // TRANSACTION TYPE
    if (req.query.transactionType === "deposit") {
      bankQuery.deposit = { $gt: 0 };
    }

    if (req.query.transactionType === "withdrawal") {
      bankQuery.withdrawal = { $gt: 0 };
    }

    // =========================================================
    // BANK ACCOUNTS
    // =========================================================

    const accounts = [
      { model: AC1Transaction, account: "AC1" },
      { model: AC2Transaction, account: "AC2" },
      { model: AC3Transaction, account: "AC3" },
      { model: AC4Transaction, account: "AC4" },
      { model: AC5Transaction, account: "AC5" },
    ];

    const selectedAccounts = req.query.account
      ? accounts.filter((item) => item.account === req.query.account)
      : accounts;

    if (req.query.account && !selectedAccounts.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid account",
      });
    }

    // =========================================================
    // EXPENSE CODE OPTIONS
    // =========================================================

    const expenseCodeOptions = await OptionsData.findOne({
      categoryKey: "expensecode",
    })
      .select("items")
      .lean();

    const expenseCodeMap = new Map(
      (expenseCodeOptions?.items || []).map((item) => [
        String(item._id),
        {
          label: item.label,
          value: item.value,
          id: item._id,
        },
      ]),
    );

    // =========================================================
    // BANK TRANSACTION AGGREGATION
    // =========================================================

    const firstAccount = selectedAccounts[0];

    let bankPipeline = [];

    if (firstAccount) {
      bankPipeline = [
        { $match: bankQuery },
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: candidateLimit },
        {
          $addFields: {
            account: firstAccount.account,
          },
        },
      ];

      for (let i = 1; i < selectedAccounts.length; i++) {
        const account = selectedAccounts[i];

        bankPipeline.push({
          $unionWith: {
            coll: account.model.collection.name,
            pipeline: [
              { $match: bankQuery },
              { $sort: { createdAt: -1, _id: -1 } },
              { $limit: candidateLimit },
              {
                $addFields: {
                  account: account.account,
                },
              },
            ],
          },
        });
      }

      bankPipeline.push({
        $sort: {
          createdAt: -1,
          _id: -1,
        },
      });

      // No skip/limit here.
      // Global pagination will happen after combining both sources.

      bankPipeline.push(
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "properties",
            localField: "propertyId",
            foreignField: "_id",
            as: "property",
          },
        },
        {
          $unwind: {
            path: "$property",
            preserveNullAndEmptyArrays: true,
          },
        },
      );
    }

    // =========================================================
    // FETCH BOTH DATA SOURCES + EXACT TOTALS
    // =========================================================

    const bankDataPromise = firstAccount
      ? firstAccount.model.aggregate(bankPipeline, {
          allowDiskUse: true,
        })
      : Promise.resolve([]);

    const bankTotalPromises = selectedAccounts.map(
      async ({ model, account }) => {
        const result = await model.aggregate([
          { $match: bankQuery },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalDeposit: {
                $sum: { $ifNull: ["$deposit", 0] },
              },
              totalWithdrawal: {
                $sum: { $ifNull: ["$withdrawal", 0] },
              },
            },
          },
        ]);

        return {
          account,
          ...(result[0] || {
            count: 0,
            totalDeposit: 0,
            totalWithdrawal: 0,
          }),
        };
      },
    );

    const [
      propertyExpenseRecords,
      propertyExpenseSummary,
      bankTransactionsResult,
      bankAccountTotals,
    ] = await Promise.all([
      PropertyExpense.find(propertyExpenseQuery)
        .sort({ expenseDate: -1, _id: -1 })
        .limit(candidateLimit)
        .lean(),

      PropertyExpense.aggregate([
        { $match: propertyExpenseQuery },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),

      bankDataPromise,

      Promise.all(bankTotalPromises),
    ]);

    // =========================================================
    // FORMAT PROPERTY EXPENSES
    // =========================================================

    const formattedPropertyExpenses = propertyExpenseRecords.map((expense) => ({
      ...expense,

      // Common fields for existing frontend
      date: expense.expenseDate,
      valueDate: expense.expenseDate,

      narration: expense.description || expense.category || "-",

      expenseCategory: expense.category || "-",

      withdrawal: Number(expense.amount || 0),
      deposit: 0,

      balance: 0,

      chqNo: "-",
      account: expense.paymentMode || "Property Expense",

      source: "Property Expense",

      assignee: expense.createdBy?.fullName || "-",
      reviewer: "-",
      auditor: "-",

      status: expense.status || "Updated",

      expenseCode: null,

      isMapped: false,
      mappedAt: null,

      workLogs: expense.workLogs || [],

      sourceType: "PROPERTY_EXPENSE",
      isReadOnly: false,
    }));

    // =========================================================
    // FORMAT BANK TRANSACTIONS
    // =========================================================

    const formattedBankTransactions = (bankTransactionsResult || []).map(
      (transaction) => {
        const user = transaction.user;
        const populatedProperty = transaction.property;

        return {
          ...transaction,

          // Same common expense format
          expenseDate: transaction.valueDate || transaction.date,
          valueDate: transaction.valueDate || null,
          category: transaction.expenseCategory || "-",
          amount: Number(transaction.withdrawal || 0),
          // Extra bank transaction fields
          withdrawal: Number(transaction.withdrawal || 0),
          narration: transaction.narration || "-",
          // Payment mode based on narration
          paymentMode: /upi/i.test(transaction.narration || "")
            ? "UPI"
            : "Bank",
          // userId: transaction.userId
          //   ? {
          //       _id: transaction.userId,
          //       fullName: user?.fullName || "",
          //     }
          //   : null,
          propertyId: transaction.propertyId
            ? {
                _id: transaction.propertyId._id,
                propertyCode: populatedProperty?.propertyCode || "",
              }
            : null,

          expenseCode: transaction.expenseCode
            ? expenseCodeMap.get(String(transaction.expenseCode)) || null
            : null,

          user: undefined,
          property: undefined,

          sourceType: "BANK_TRANSACTION",
          isReadOnly: true,
        };
      },
    );

    // =========================================================
    // COMBINE BOTH COLLECTIONS
    // =========================================================

    const allExpenses = [
      ...formattedPropertyExpenses,
      ...formattedBankTransactions,
    ];

    // Global date-wise sorting
    allExpenses.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();

      if (dateB !== dateA) {
        return dateB - dateA;
      }

      return String(b._id).localeCompare(String(a._id));
    });

    // =========================================================
    // GLOBAL PAGINATION
    // =========================================================

    const totalPropertyRecords = Number(propertyExpenseSummary[0]?.count || 0);

    const totalBankRecords = bankAccountTotals.reduce(
      (sum, item) => sum + Number(item.count || 0),
      0,
    );

    const totalRecords = totalPropertyRecords + totalBankRecords;

    const totalPages = Math.ceil(totalRecords / limit);

    const paginatedExpenses = allExpenses.slice(skip, skip + limit);

    // =========================================================
    // SUMMARY TOTALS
    // =========================================================

    const propertyExpenseTotal = Number(
      propertyExpenseSummary[0]?.totalAmount || 0,
    );

    const bankTotalDeposit = bankAccountTotals.reduce(
      (sum, item) => sum + Number(item.totalDeposit || 0),
      0,
    );

    const bankTotalWithdrawal = bankAccountTotals.reduce(
      (sum, item) => sum + Number(item.totalWithdrawal || 0),
      0,
    );

    const totalWithdrawal = propertyExpenseTotal + bankTotalWithdrawal;

    const availableAccounts = [
      ...new Set([
        ...bankAccountTotals
          .filter((item) => item.count > 0)
          .map((item) => item.account),
        ...(totalPropertyRecords > 0 ? ["Property Expense"] : []),
      ]),
    ];

    // =========================================================
    // CATEGORY SUMMARY
    // =========================================================

    const propertyCategorySummary = await PropertyExpense.aggregate([
      { $match: propertyExpenseQuery },
      {
        $group: {
          _id: "$category",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // =========================================================
    // FINAL RESPONSE
    // =========================================================

    return res.status(200).json({
      success: true,

      property: {
        _id: property._id,
        propertyCode: property.propertyCode || "",
        propertyLocation: property.propertyLocation || "",
      },

      page,
      limit,

      totalRecords,
      totalPages,

      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,

      count: paginatedExpenses.length,

      data: paginatedExpenses,

      totalDeposit: bankTotalDeposit,

      totalWithdrawal,

      // Additional summaries
      summary: {
        propertyExpenseTotal,
        bankTotalDeposit,
        bankTotalWithdrawal,
        totalExpenses: totalWithdrawal,
        totalRecords,
        categorySummary: propertyCategorySummary,
      },

      availableAccounts,

      sourceSummary: {
        propertyExpenseRecords: totalPropertyRecords,
        bankTransactionRecords: totalBankRecords,
      },
    });
  } catch (error) {
    console.error("getPropertyExpensesWithBankTransactions:", error);

    if (
      error.message === "Invalid fromDate" ||
      error.message === "Invalid toDate" ||
      error.message === "fromDate cannot be after toDate" ||
      error.message === "Invalid valueFromDate" ||
      error.message === "Invalid valueToDate" ||
      error.message === "valueFromDate cannot be after valueToDate"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch property expenses",
      error: error.message,
    });
  }
};