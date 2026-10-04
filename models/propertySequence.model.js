const mongoose = require("mongoose");

const PropertySequenceSchema = new mongoose.Schema(
  {
    propertyCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    sequence: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("PropertySequence", PropertySequenceSchema);