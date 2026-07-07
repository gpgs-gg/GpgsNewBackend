const Ticket = require("../models/ticket.model");
const asyncHandler = require("../middleware/asyncHandler");
const uploadFile = require("../services/uploadFile");
const ApiError = require("../utils/ApiError");
const  { convertStringFormatDateTime,convertStringToDateTime}  = require("../utils/dateFormatter");
const createTicket = asyncHandler(async (req, res) => {
  // Generate Ticket ID
  const lastTicket = await Ticket.findOne().sort({ createdAt: -1 });
  const year = new Date().getFullYear();
let ticketId = `TKT-${year}-0001`;
if (lastTicket) {
  const lastNumber = parseInt(
    lastTicket.ticketId.split("-")[2],
    10
  );
  ticketId = `TKT-${year}-${String(lastNumber + 1).padStart(4, "0")}`;
}
  // Upload attachments
  const attachments = await Promise.all(
    (req.files || []).map((file) =>
      uploadFile(file, `Tickets/${ticketId}`)
    )
  );
  // Create Ticket
  const ticket = await Ticket.create({
    ...req.body,
    ticketId,
    status: "Open",
    attachment: attachments,
    dateCreated: convertStringFormatDateTime(new Date())
  });

  res.status(201).json({
    success: true,
    message: "Ticket created successfully",
    data: ticket,
  });
});

const getAllTickets = asyncHandler(async (req, res) => {
  const tickets = await Ticket.find().sort({
    createdAt: -1,
  });

  res.status(200).json({
    success: true,
    count: tickets.length,
    data: tickets,
  });
});

const getTicketById = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);

 if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  res.status(200).json({
    success: true,
    data: ticket,
  });
});



const calculateAcknowledged = (ticket, newStatus) => {
  let acknowledgedDate = ticket.acknowledgedDate;
  let lateAcknowledged = ticket.lateAcknowledged;


  const acknowledgementStatuses = [
    "Acknowledged",
    "In Progress",
    "Resolved",
    "Closed",
  ];

  if (
    ticket.status === "Open" &&
    acknowledgementStatuses.includes(newStatus) &&
    !ticket.acknowledgedDate
  ) {
    // const now = convertStringFormatDateTime(new Date());

    // acknowledgedDate = now;

    // let deadline = new Date(ticket.dateCreated);

    // const hour = deadline.getHours();

    // if (hour < 10) {
    //   deadline.setHours(10, 30, 0, 0);
    // } else if (hour >= 20) {
    //   deadline.setDate(deadline.getDate() + 1);
    //   deadline.setHours(10, 30, 0, 0);
    // } else {
    //   deadline = new Date(
    //     deadline.getTime() + 30 * 60 * 1000
    //   );
    // }

    // lateAcknowledged =
    //   now > deadline ? "Yes" : "No";
    const now = new Date();

acknowledgedDate = convertStringFormatDateTime(now);

const createdTime = convertStringToDateTime(ticket.dateCreated);

let deadline = new Date(createdTime);

const hour = createdTime.getHours();

if (hour < 10) {
  deadline.setHours(10, 30, 0, 0);
} else if (hour >= 20) {
  deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(10, 30, 0, 0);
} else {
  deadline = new Date(createdTime.getTime() + 30 * 60 * 1000);
}

lateAcknowledged = now > deadline ? "Yes" : "No";
  }

  return {
    acknowledgedDate,  
    lateAcknowledged,
  };
};

const calculateResolved = (ticket, newStatus) => {
  let lateResolved = ticket.lateResolved || "";

  if (
    ticket.status !== "Resolved" &&
    newStatus === "Resolved"
  ) {
    const acknowledgedDate = convertStringToDateTime(ticket.acknowledgedDate);
    const priority = ticket.priority;

    if (acknowledgedDate && priority) {
      const now = new Date();

      const diffHours =
        (now - new Date(acknowledgedDate)) /
        (1000 * 60 * 60);

      let slaHours = 0;

      switch (priority.toLowerCase()) {
        case "low":
          slaHours = 72;
          break;
        case "medium":
          slaHours = 48;
          break;
        case "high":
          slaHours = 24;
          break;
        case "critical":
          slaHours = 8;
          break;
      }

      lateResolved =
        slaHours > 0 && diffHours > slaHours
          ? "Yes"
          : "No";
    }
  }

  return { lateResolved };
};

const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  const newStatus = req.body.status;

const acknowledgeData = calculateAcknowledged(
  ticket,
  newStatus
);

const resolveData = calculateResolved(
  ticket,
  newStatus
);
    if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  let attachments = [];

if (req.body.existingAttachments) {
  attachments = JSON.parse(req.body.existingAttachments);
}

delete req.body.existingAttachments;

if (req.files?.length) {
  const uploadedFiles = await Promise.all(
    req.files.map((file) =>
      uploadFile(file, `Tickets/${ticket.ticketId}`)
    )
  );

  attachments = [...attachments, ...uploadedFiles];
}

let auditorLogs = ticket.auditorLogs || [];

let auditorMessage = "";

if (Array.isArray(req.body.auditorLog)) {
  auditorMessage = req.body.auditorLog[0];
} else {
  auditorMessage = req.body.auditorLog;
}

auditorMessage = String(auditorMessage || "").trim();

if (auditorMessage) {
  auditorLogs.push({
    message: auditorMessage,
    createdBy: req.body.updatedByName,
    createdAt: new Date(),
  });
}

  const updatedTicket = await Ticket.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
       auditorLogs,
      attachment: attachments,
      updatedDateTime: convertStringFormatDateTime(new Date()),
         acknowledgedDate:
      acknowledgeData.acknowledgedDate,

    lateAcknowledged:
      acknowledgeData.lateAcknowledged,

    lateResolved:
      resolveData.lateResolved,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    success: true,
    message: "Ticket updated successfully",
    data: updatedTicket,
  });
});

const deleteTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findByIdAndDelete(req.params.id);

   if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  res.status(200).json({
    success: true,
    message: "Ticket deleted successfully",
  });
});

const addWorkLog = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findByIdAndUpdate(
    req.params.id,
    {
      $push: {
        workLogs: {
          message: req.body.message,
          createdBy: req.body.createdBy,
          createdAt: new Date(),
        },
      },
    },
    {
      new: true,
    }
  );

  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  res.status(200).json({
    success: true,
    message: "WorkLog added successfully",
    data: ticket,
  });
});

module.exports = {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  addWorkLog,
};