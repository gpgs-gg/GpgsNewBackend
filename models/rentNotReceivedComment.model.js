const mongoose = require("mongoose");

const RentNotReceivedCommentSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      unique: true,
      index: true,
    },

    // propertyId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Property",
    //   required: true,
    // },

    // bedId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Bed",
    //   required: true,
    // },

    comments: [
      {
        comment: {
          type: String,
          required: true,
          trim: true,
        },

        date: {
          type: Date,
          default: Date.now,
        },

        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "RentNotReceivedComment",
  RentNotReceivedCommentSchema
);