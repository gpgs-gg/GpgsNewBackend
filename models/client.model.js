const mongoose = require("mongoose");

const BedHistorySchema = new mongoose.Schema(
    {
        propertyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Property",
        },

        propertyCode: String,

        bedId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bed",
        },

        bedNo: String,

        stayType: String,

        fromDate: Date,
        toDate: Date,

        remarks: String,
    },
    { _id: false }
);

const ClientSchema = new mongoose.Schema(
    {
        // ===================================
        // PROPERTY & BED
        // ===================================

        propertyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Property",
            required: true,
            index: true,
        },

        // Current Bed
        bedId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bed",
            required: true,
            index: true,
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
        },
        // Reserved/Future Bed (Optional)
        reservedBedId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bed",
            default: null,
        },

        stayType: {
            type: String,
            enum: ["P. Booked", "T. Booked"],
            default: "P. Booked",
        },

        // ===================================
        // CLIENT DETAILS
        // ===================================

        fullName: {
            type: String,
            required: true,
            trim: true,
        },

        whatsappNo: {
            type: String,
            trim: true,
        },

        callingNo: {
            type: String,
            trim: true,
        },

        emailId: {
            type: String,
            trim: true,
            lowercase: true,
        },

        bloodGroup: String,

        occupation: String,

        organization: String,

        comments: String,

        parkingCharges: {
            type: Number,
            enum: [0, 250, 500],
            default: 0,
        },
        isBookingCancelled: {
            type: Boolean,
            default: false
        },

        bookingDate: Date,

        rentStartDate: Date,

        noticeStartDate: Date,
        noticeLastDate: Date,
        clientVacatingDate: Date,

        // ===================================
        // DOCUMENTS
        // ===================================

        photo: [String],

        aadhaarCard: [String],

        pan: [String],

        collegeIdentification: [String],

        companyIdentification: [String],

        clientRentalAgreement: [String],

        clientPoliceNOC: [String],

        attachments: [String],

        // ===================================
        // EMERGENCY CONTACTS
        // ===================================

        emergencyContact1FullName: String,
        emergencyContact1ContactNumber: String,

        emergencyContact2FullName: String,
        emergencyContact2ContactNumber: String,

        // ===================================
        // BED HISTORY
        // ===================================

        bedHistory: [BedHistorySchema],

        // ===================================
        // WORKLOGS
        // ===================================

        worklogs: [
            {
                message: String,

                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// ===================================
// INDEXES
// ===================================

ClientSchema.index({
    propertyId: 1,
    status: 1,
});

ClientSchema.index({
    propertyId: 1,
    bedId: 1,
});

ClientSchema.index({
    status: 1,
});

module.exports = mongoose.model("Client", ClientSchema);