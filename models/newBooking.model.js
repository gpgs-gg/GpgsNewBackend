const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
    {
        // Client Details
        fullName: {
            type: String,
            required: true,
            trim: true,
        },

        emailId: {
            type: String,
            trim: true,
            lowercase: true,
        },

        callingNo: {
            type: String,
            required: true,
        },

        whatsappNo: String,

        askFor: String,

        // Emergency Contacts
        emergencyContact1FullName: String,
        emergencyContact1No: String,

        emergencyContact2FullName: String,
        emergencyContact2No: String,

        // Permanent Booking
        propertyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Property",
        },

        bedId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bed",
        },

        monthlyRent: Number,

        depositAmount: Number,
        bookingAmout: Number,
        clientCalculatedRent: Number,

        clientDoj: {
            type: String,
            default: null,
        },

        clientLastDate: {
            type: String,
            default: null,
        },

        comments: String,

        parkingCharges: {
            type: Number,
            default: 0,
        },

        processingFees: {
            type: Number,
            default: 0,
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


        // Temporary Booking
        temporaryPropertyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Property",
        },

        temporaryBedId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bed",
        },

        temporaryMonthlyRent: Number,

        temporaryClientCalculatedRent: Number,

        temporaryClientDoj: {
            type: String,
            default: null,
        },

        temporaryClientLastDate: {
            type: String,
            default: null,
        },


        temporaryComments: String,

        temporaryParkingCharges: {
            type: Number,
            default: 0,
        },
        temporaryTotalAmount: {
            type: Number,
            default: 0,
        },
        partialAmount: {
            type: Number,
            default: 0,
        },
        
        // Advance / Hold
        URHA: {
            type: Number,
            default: 0,
        },

        URHD: String,
        loginEnabled: {
            type: Boolean,
            default: false
        },
        // Payment Proof
        paymentAttachment: [String],

        // // Booking Type
        // isPermanent: {
        //   type: Boolean,
        //   default: false,
        // },

        // isTemporary: {
        //   type: Boolean,
        //   default: false,
        // },
        isCancelled: {
            type: Boolean,
            default: false,
        },

        cancelledDate: {
            type: String,
            default: null,
        },
        // Status
        status: {
            type: String,
            enum: ["Booked", "Not Booked"],
            default: "Not Booked",
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model(
    "Booking",
    bookingSchema
);