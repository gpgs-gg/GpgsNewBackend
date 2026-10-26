const mongoose = require("mongoose");
const PropertyExpense = require("../models/propertyExpense.model");
const Property = require("../models/property.model");

const CATEGORIES = [
  "Property Rent",
  "Housekeeping",
  "Internet",
  "Electricity",
  "Cooking Gas",
  "Water",
  "Police NOC",
  "Repairs / Maintenance",
  "Furniture",
  "Appliances",
  "Other",
];

const PAYMENT_MODES = [
  "Cash",
  "Bank",
  "UPI",
  "Cheque",
  "Other",
];

const isValidId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

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

    filter.propertyId = new mongoose.Types.ObjectId(
      query.propertyId
    );
  }

  if (query.category) {
    if (!CATEGORIES.includes(query.category)) {
      const error = new Error("Invalid expense category");
      error.statusCode = 400;
      throw error;
    }

    filter.category = query.category;
  }

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
    description,
    receiptUrl,
  } = body;

  if (!propertyId || !isValidId(propertyId)) {
    return "Please select a valid property";
  }

  if (
    !expenseDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)
  ) {
    return "Valid expense date is required (YYYY-MM-DD)";
  }

  const parsedDate = new Date(`${expenseDate}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== expenseDate
  ) {
    return "Invalid expense date";
  }

  if (!CATEGORIES.includes(category)) {
    return "Valid expense category is required";
  }

  if (
    amount === "" ||
    amount === null ||
    amount === undefined ||
    !Number.isFinite(Number(amount)) ||
    Number(amount) < 0
  ) {
    return "Amount must be a valid non-negative number";
  }

  if (
    paymentMode &&
    !PAYMENT_MODES.includes(paymentMode)
  ) {
    return "Invalid payment mode";
  }

  if (
    description !== undefined &&
    typeof description !== "string"
  ) {
    return "Description must be text";
  }

  if (
    receiptUrl !== undefined &&
    typeof receiptUrl !== "string"
  ) {
    return "Receipt URL must be text";
  }

  return null;
};

// GET /api/property-expenses
exports.getExpenses = async (req, res) => {
  try {
    const filter = buildFilters(req.query);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 10)
    );
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

    const expense = await PropertyExpense.create({
      propertyId: property._id,
      propertyCodeSnapshot: property.propertyCode || "",
      expenseDate: new Date(
        `${req.body.expenseDate}T00:00:00.000Z`
      ),
      category: req.body.category,
      amount: Number(req.body.amount),
      paymentMode: req.body.paymentMode || "Bank",
      description: req.body.description || "",
      receiptUrl: req.body.receiptUrl || "",
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
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

    const property = await getProperty(req.body.propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const expense = await PropertyExpense.findByIdAndUpdate(
      req.params.id,
      {
        propertyId: property._id,
        propertyCodeSnapshot: property.propertyCode || "",
        expenseDate: new Date(
          `${req.body.expenseDate}T00:00:00.000Z`
        ),
        category: req.body.category,
        amount: Number(req.body.amount),
        paymentMode: req.body.paymentMode || "Bank",
        description: req.body.description || "",
        receiptUrl: req.body.receiptUrl || "",
        updatedBy: req.user?._id || null,
      },
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    return res.json({
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

    const expense = await PropertyExpense.findByIdAndDelete(
      req.params.id
    );

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

    const totalAmount = data.reduce(
      (sum, item) => sum + item.totalAmount,
      0
    );

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
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 10)
    );

    const filter = {
      propertyId: new mongoose.Types.ObjectId(propertyId),
    };

    if (req.query.category) {
      if (!CATEGORIES.includes(req.query.category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid expense category",
        });
      }

      filter.category = req.query.category;
    }

    if (req.query.fromDate || req.query.toDate) {
      filter.expenseDate = {};

      if (req.query.fromDate) {
        const from = new Date(
          `${req.query.fromDate}T00:00:00.000Z`
        );

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
        const to = new Date(
          `${req.query.toDate}T23:59:59.999Z`
        );

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

    const [expenses, countResult, categorySummary] =
      await Promise.all([
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
        totalPages: Math.ceil(
          summary.totalRecords / limit
        ),
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