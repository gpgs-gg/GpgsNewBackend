const mongoose = require("mongoose");

const WorklogChangeSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
      trim: true,
    },

    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const WorklogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    changes: {
      type: [WorklogChangeSchema],
      default: [],
    },

    // Authentication is not implemented yet
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Temporary user name
    updatedByName: {
      type: String,
      default: "Pooja",
      trim: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  },
);

module.exports = WorklogSchema;