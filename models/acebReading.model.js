const mongoose = require("mongoose");

const RoomReadingSchema = new mongoose.Schema(
  {
    areaId: {
      type: String,
      required: true
    },

    currentReading: {
      type: Number,
      default: 0
    },

    previousReading: {
      type: Number,
      default: 0
    },

    consumedUnits: {
      type: Number,
      default: 0
    },

    aceb: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const ACElectricityReadingSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true
    },

    month: {
      type: String,
      required: true
    },

    date: {
      type: String,
      required: true
    },

    flatTotalEB: {
      type: Number,
      default: 0
    },

    flatTotalUnits: {
      type: Number,
      default: 0
    },

    perUnitCost: {
      type: Number,
      default: 0
    },

    roomReadings: {
      type: [RoomReadingSchema],
      default: []
    },

    actualTotalUnits: {
      type: Number,
      default: 0
    },

    actualTotalEB: {
      type: Number,
      default: 0
    },

    commonTotalEB: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

ACElectricityReadingSchema.index(
  { propertyId: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "ACElectricityReading",
  ACElectricityReadingSchema
);