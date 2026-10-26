const mongoose = require("mongoose");

const PROPERTY_EXPENSE_CATEGORIES = [
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

const propertyExpenseSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },

    propertyCodeSnapshot: {
      type: String,
      default: "",
      trim: true,
    },

    expenseDate: {
      type: Date,
      required: true,
    },

    category: {
      type: String,
      enum: PROPERTY_EXPENSE_CATEGORIES,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMode: {
      type: String,
      enum: ["Cash", "Bank", "UPI", "Cheque", "Other"],
      default: "Bank",
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    // receiptUrl: {
    //   type: String,
    //   trim: true,
    //   default: "",
    // },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

propertyExpenseSchema.index({
  propertyId: 1,
  expenseDate: -1,
  _id: -1,
});

propertyExpenseSchema.index({
  category: 1,
  expenseDate: -1,
});

module.exports = mongoose.model(
  "PropertyExpense",
  propertyExpenseSchema
);