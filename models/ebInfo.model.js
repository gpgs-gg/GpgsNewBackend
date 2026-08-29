const mongoose = require("mongoose");

const EBInfoSchema = new mongoose.Schema(
    {
        // ---------------- PROPERTY ----------------
        propertyCode: {
            type: String,
            required: true,
            index: true,
        },

        // ---------------- MONTH ----------------
        // Example: "2026-09"
        billingMonth: {
            type: String,
            required: true,
            index: true,
        },

        // ---------------- MONTHLY EB DATA ----------------

        EBCycle: {
            type: String,
            default: null,
        },

        flatUnits: {
            type: Number,
            default: null,
        },

        flatEB: {
            type: Number,
            default: null,
        },

        assignee: {
            type: String,
            default: "",
        },

        reviewer: {
            type: String,
            default: "",
        },

        ebPaidStatus: {
            type: String,
            default: "",
        },

        status: {
            type: String,
            default: "Open",
        },

        attachment: {
            type: String,
            default: "",
        },

        workLogs: [
            {
                message: String,
                createdBy: String,
                createdAt: {
                    type: String,
                    default: String,
                },
            },
        ],

    },
    {
        timestamps: true,
    }
);

// एक Property + एक Month = एकच monthly record
EBInfoSchema.index(
    { propertyCode: 1, billingMonth: 1 },
    { unique: true }
);

module.exports = mongoose.model("EBInfo", EBInfoSchema);