const mongoose = require("mongoose");

const EBClientSchema = new mongoose.Schema(
    {
        PropertyCode: {
            type: String,
            default: "",
        },

        PropertyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Property",
        },

        FlatEB: {
            type: Number,
            default: 0,
        },

        CommonEB: {
            type: Number,
            default: 0,
        },

        EBStartDate: {
            type: String,
            default: "",
        },

        EBEndDate: {
            type: String,
            default: "",
        },

        ClientName: {
            type: String,
            default: "",
        },

        ClientID: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
        },

        ebDoj: Date,

        RoomNo: String,
        BedNo: String,
        ACRoom: String,

        VacationStart1: String,
        VacationEnd1: String,
        VacationStart2: String,
        VacationEnd2: String,

        CEB: {
            type: Number,
            default: 0,
        },

        ACEB: {
            type: Number,
            default: 0,
        },

        TotalDays: {
            type: Number,
            default: 0,
        },

        AdjFreeEB: {
            type: Number,
            default: 0,
        },

        AdjEB: {
            type: Number,
            default: 0,
        },

        FreeEB: {
            type: Number,
            default: 0,
        },

        PropertyFreeEB: {
            type: Number,
            default: 0,
        },

        EBToBeRecovered: {
            type: Number,
            default: 0,
        },

        PropertyEBUnits: {
            type: Number,
            default: 0,
        },

        FreeEBPerDay: {
            type: Number,
            default: 0,
        },

        TotalClientEB: {
            type: Number,
            default: 0,
        },

        EBAmt: {
            type: Number,
            default: 0,
        },

        Comments1: {
            type: String,
            default: "N/A",
        },

        Comments2: {
            type: String,
            default: "N/A",
        },

        FlatTotalEB: {
            type: Number,
            default: 0,
        },

        FlatTotalUnits: {
            type: Number,
            default: 0,
        },

        PerUnitCost: {
            type: Number,
            default: 0,
        },

        ACTotalUnits: {
            type: Number,
            default: 0,
        },

        ACTotalEB: {
            type: Number,
            default: 0,
        },
    },
    { _id: false }
);


// ======================================================
// MAIN EB CALCULATION
// ======================================================

const EBCalculationSchema = new mongoose.Schema(
    {
        PropertyCode: {
            type: String,
            required: true,
        },

        PropertyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Property",
            required: true,
        },

        EBStartDate: {
            type: String,
            required: true,
        },

        EBEndDate: {
            type: String,
            required: true,
        },

        clients: {
            type: [EBClientSchema],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model(
    "EBCalculation",
    EBCalculationSchema
);