const mongoose = require("mongoose");

/**
 * ==========================================================
 * Master Item Schema
 * ----------------------------------------------------------
 * Represents a single option inside a master category.
 *
 * Example:
 *
 * Category : Sharing Type
 * Items:
 * - Private
 * - Double
 * - Triple
 * - Quad
 * ==========================================================
 */
const itemSchema = new mongoose.Schema(
  {
    /**
     * Display text shown in the UI.
     *
     * Examples:
     * Private
     * Double
     * Active
     * Male
     */
    label: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * Value stored in the database.
     * Usually same as label but can be different.
     *
     * Examples:
     * private
     * double
     * active
     * male
     */
    value: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * Optional business code.
     * Useful when labels change but code remains fixed.
     *
     * Examples:
     * PRIVATE
     * ACTIVE
     * CASH
     */
    code: {
      type: String,
      trim: true,
      uppercase: true,
    },

    /**
     * Controls the display order in dropdowns.
     *
     * Example:
     * Private -> 1
     * Double  -> 2
     * Triple  -> 3
     */
    displayOrder: {
      type: Number,
      default: 1,
    },

    /**
     * Indicates whether this option is the default
     * selected value for the category.
     *
     * Example:
     * ✔ Private
     *   Double
     *   Triple
     */
    isDefault: {
      type: Boolean,
      default: false,
    },

    /**
     * Enables or disables this option.
     *
     * Inactive values can be hidden from dropdowns
     * without deleting them.
     */
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    // Generates unique _id for every item.
    // Required for updating/removing individual options.
    _id: true,
  },
);

/**
 * ==========================================================
 * Master Category Schema
 * ----------------------------------------------------------
 * Represents one master category.
 *
 * Examples:
 *
 * Category Name : Sharing Type
 * Category Key  : sharingType
 *
 * Category Name : Client Status
 * Category Key  : clientStatus
 *
 * Category Name : Property Location
 * Category Key  : propertyLocation
 * ==========================================================
 */
const optionsDataSchema = new mongoose.Schema(
  {
    /**
     * Unique identifier used in frontend/backend.
     *
     * Examples:
     * sharingType
     * clientStatus
     * paymentMode
     * propertyLocation
     */
    categoryKey: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    /**
     * Human readable category name.
     *
     * Examples:
     * Sharing Type
     * Client Status
     * Property Location
     */
    categoryName: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * Optional description of the category.
     *
     * Example:
     * "Used for all property location dropdowns."
     */
    description: {
      type: String,
      trim: true,
    },

    /**
     * Collection of options belonging
     * to this category.
     *
     * Example:
     *
     * Sharing Type
     * ├── Private
     * ├── Double
     * ├── Triple
     * └── Quad
     */
    items: [itemSchema],

    /**
     * User who created this category.
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /**
     * Last user who updated this category.
     */
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    // Automatically creates:
    // createdAt
    // updatedAt
    timestamps: true,
  },
);

/**
 * ==========================================================
 * Indexes
 * ==========================================================
 */

/**
 * Quickly finds categories by key.
 *
 * Example:
 * MasterData.findOne({
 *   categoryKey: "sharingType"
 * });
 */
// optionsDataSchema.index({
//   categoryKey: 1,
// });

module.exports = mongoose.model("OptionsData", optionsDataSchema);