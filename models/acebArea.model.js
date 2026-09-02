const mongoose = require("mongoose");

const AreaSchema = new mongoose.Schema(
    {
        areaId: {
            type: String,
            unique: true,
            default: () => new mongoose.Types.ObjectId().toString()
        },

        name: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ["ROOM", "KITCHEN", "HALL", "COMMON"],
            required: true
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { _id: false }
);

const PropertySchema = new mongoose.Schema(
    {
        propertyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Property",
            required: true
        },
        lastMonth: {
            type: String,
            default: true
        },

        location: {
            type: String,
            trim: true
        },

        areas: {
            type: [AreaSchema],
            default: []
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("ACEBPropertyArea", PropertySchema);