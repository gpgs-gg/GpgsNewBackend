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
        bookingAmout : Number,
        clientCalculatedRent: Number,

        clientDoj: Date,

        clientLastDate: Date,

        comments: String,

        parkingCharges: {
            type: Number,
            default: 0,
        },

        processingFees: {
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

        temporaryClientDoj: Date,

        temporaryClientLastDate: Date,

        temporaryComments: String,

        temporaryParkingCharges: {
            type: Number,
            default: 0,
        },

        // Advance / Hold
        URHA: {
            type: Number,
            default: 0,
        },

        URHD: String,

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

        cancelledDate: Date,
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