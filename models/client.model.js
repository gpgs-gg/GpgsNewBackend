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
        fromDate: {
            type: String,
            trim: true
        }, toDate: {
            type: String,
            trim: true
        },
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
            default: 0,
        },
        processingFees: {
            type: Number,
            default: 0,
        },
        isBookingCancelled: {
            type: Boolean,
            default: false
        },

        bookingDate: {
            type: String,
            trim: true
        },

        clientDoj: {
            type: String,
            trim: true
        },

        ebDoj: {
            type: String,
            trim: true
        },
        clientLastDate: {
            type: String,
            trim: true
        },
        noticeStartDate: {
            type: String,
            trim: true
        },
        noticeLastDate: {
            type: String,
            trim: true
        },

        clientVacatingDate: {
            type: String,
            trim: true
        },


        vacationStartDate1: {
            type: String,
            trim: true
        },
        vacationLastDate1: {
            type: String,
            trim: true
        },

        vacationStartDate2: {
            type: String,
            trim: true
        },
        vacationLastDate2: {
            type: String,
            trim: true
        },
        agreementStartDate: {
            type: String,
            trim: true
        },
        agreementLastDate: {
            type: String,
            trim: true
        },

        totalAmount: {
            type: Number,
            default: 0,
        },
        bookingAmount: {
            type: Number,
            default: 0,
        },
        balanceAmount: {
            type: Number,
            default: 0,
        },
        
        temporaryParkingCharges: {
            type: Number,
            default: 0,
        },
        temporaryTotalAmount: {
            type: Number,
            default: 0,
        },

        loginEnabled: {
            type: Boolean,
            default: false
        },
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