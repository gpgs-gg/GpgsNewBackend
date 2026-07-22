const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true, // <-- Add this
    },

    dateCreated: String,
    propertyCode: String,

    title: String,
    description: String,
    targetDate: Date,

    attachment: [String],

    customerImpacted: String,
    escalated: String,

    category: String,
    status: String,
    priority: String,
    department: String,

    manager: String,
    ticketManager: String,
    assignee: String,

    createdBy: String,
    createdById: String,
    createdByName: String,

    closedDate: Date,

    updatedById: String,
    updatedByName: String,
    updatedDateTime: String,

    lateResolved: String,

    acknowledgedDate: String,
    lateAcknowledged: String,

    workLogs: [
      {
        message: String,
        createdBy: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    internalComments: String,

    estimatedTimeToResolve: String,
    actualTimeSpent: String,

    auditorLogs: [
      {
        message: String,
        createdBy: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    teamCode: String,
    propertyLocation: String,
  },
  {
    timestamps: true,
  }
);

// Explicit indexes
TicketSchema.index({ ticketId: 1 }, { unique: true });
TicketSchema.index({ createdAt: -1 });
TicketSchema.index({ propertyCode: 1 });
TicketSchema.index({ status: 1 });
TicketSchema.index({ priority: 1 });
TicketSchema.index({ department: 1 });

module.exports = mongoose.model("Ticket", TicketSchema);