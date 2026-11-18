const mongoose = require("mongoose");

const websiteSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "heroVideo",
    },

    videoUrl: {
      type: String,
      required: true,
    },

    publicId: {
      type: String,
      required: true,
    },

    format: {
      type: String,
      default: "mp4",
    },

    updatedBy: {
      type: String,
      default: "Admin",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("WebsiteSettings", websiteSettingsSchema);