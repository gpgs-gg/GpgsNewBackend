const mongoose = require("mongoose");

const moduleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    path: {
      type: String,
      required: true,
      trim: true,
    },

    moduleType: {
      type: String,
      enum: ["MENU", "ACTION"],
      default: "MENU",
    },

    actions: {
      view: {
        type: Boolean,
        default: true,
      },

      add: {
        type: Boolean,
        default: false,
      },

      edit: {
        type: Boolean,
        default: false,
      },

      delete: {
        type: Boolean,
        default: false,
      },

      singleView: {
        type: Boolean,
        default: false,
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Module", moduleSchema);