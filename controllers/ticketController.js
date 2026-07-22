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

// const getAllTickets = asyncHandler(async (req, res) => {
//   const tickets = await Ticket.find().sort({
//     createdAt: -1,
//   });

//   res.status(200).json({
//     success: true,
//     count: tickets.length,
//     data: tickets,
//   });
// });


const getAllTickets = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 10, 1);
  const skip = (page - 1) * limit;

  const query = {};

  // ================= Search =================
  if (req.query.search) {
    query.$or = [
      {
        ticketId: {
          $regex: req.query.search,
          $options: "i",
        },
      },
      {
        title: {
          $regex: req.query.search,
          $options: "i",
        },
      },
      {
        description: {
          $regex: req.query.search,
          $options: "i",
        },
      },
      {
        propertyCode: {
          $regex: req.query.search,
          $options: "i",
        },
      },
    ];
  }

  // ================= Filters =================

  if (req.query.status) {
    query.status = req.query.status;
  }

  if (req.query.priority) {
    query.priority = req.query.priority;
  }

  if (req.query.category) {
    query.category = req.query.category;
  }

  if (req.query.department) {
    query.department = req.query.department;
  }

  if (req.query.assignee) {
    query.assignee = req.query.assignee;
  }

  if (req.query.propertyLocation) {
    query.propertyLocation = req.query.propertyLocation;
  }

  if (req.query.propertyCode) {
    query.propertyCode = req.query.propertyCode;
  }

  if (req.query.customerImpacted) {
    query.customerImpacted = req.query.customerImpacted;
  }

  if (req.query.escalated) {
    query.escalated = req.query.escalated;
  }

  if (req.query.manager) {
  query.manager = req.query.manager;
}

if (req.query.lateStatus === "LateAcknowledged") {
  query.lateAcknowledged = "Yes";
}

if (req.query.lateStatus === "LateResolved") {
  query.lateResolved = "Yes";
}

  const totalRecords = await Ticket.countDocuments(query);

  const tickets = await Ticket.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    page,
    limit,
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
    hasNextPage: page < Math.ceil(totalRecords / limit),
    hasPrevPage: page > 1,
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

const getTicketDropdown = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search?.trim() || "";

  const query = {};

  if (search) {
    query.ticketId = {
      $regex: search,
      $options: "i",
    };
  }

  const [
    statuses,
    priorities,
    departments,
    categories,
    assignees,
    managers,
    propertyLocations,
    propertyCodes,
    totalRecords,
    tickets,
  ] = await Promise.all([
    Ticket.distinct("status"),
    Ticket.distinct("priority"),
    Ticket.distinct("department"),
    Ticket.distinct("category"),
    Ticket.distinct("assignee"),
    Ticket.distinct("manager"),
    Ticket.distinct("propertyLocation"),
    Ticket.distinct("propertyCode"),

    Ticket.countDocuments(query),

    Ticket.find(query)
      .select(
        "_id ticketId propertyCode propertyLocation status priority department category assignee manager"
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  res.status(200).json({
    success: true,

    data: tickets,

    propertyCodes,
    propertyLocations,
    statuses,
    priorities,
    departments,
    categories,
    assignees,
    managers,

    customerImpacted: ["Yes", "No"],
    escalated: ["Yes", "No"],

    lateStatus: [
      {
        value: "LateAcknowledged",
        label: "Late Acknowledged",
      },
      {
        value: "LateResolved",
        label: "Late Resolved",
      },
    ],

    page,
    limit,
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
    hasMore: page * limit < totalRecords,
  });
});

const insertBulkTickets = async (req, res) => {
  try {
    const totalRecords = 20000;

    // Get last inserted ticket
    const lastTicket = await Ticket.findOne()
      .sort({ ticketId: -1 })
      .select("ticketId");

    let startNumber = 1;

    if (lastTicket && lastTicket.ticketId) {
      startNumber =
        parseInt(lastTicket.ticketId.replace("TKT", ""), 10) + 1;
    }

    const tickets = [];

    for (
      let ticketNumber = startNumber;
      ticketNumber < startNumber + totalRecords;
      ticketNumber++
    ) {
      tickets.push({
        ticketId: `TKT${String(ticketNumber).padStart(6, "0")}`,

        title: `Test Ticket ${ticketNumber}`,
        description: `This is dummy ticket ${ticketNumber}`,

        priority: ["Low", "Medium", "High", "Critical"][
          Math.floor(Math.random() * 4)
        ],

        status: ["Open", "In Progress", "Closed"][
          Math.floor(Math.random() * 3)
        ],

        department: ["Maintenance", "Accounts", "Support"][
          Math.floor(Math.random() * 3)
        ],

        category: ["Electricity", "Cleaning", "Plumbing", "Other"][
          Math.floor(Math.random() * 4)
        ],

        propertyCode: `RH${1000 + Math.floor(Math.random() * 500)}`,

        propertyLocation: `Location ${Math.floor(Math.random() * 50) + 1}`,

        customerName: `Customer ${ticketNumber}`,

        mobile:
          "9" + Math.floor(100000000 + Math.random() * 900000000),

        customerImpacted: ["Yes", "No"][
          Math.floor(Math.random() * 2)
        ],

        lateStatus: ["On Time", "Late"][
          Math.floor(Math.random() * 2)
        ],

        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Insert in batches
    const batchSize = 1000;

    for (let i = 0; i < tickets.length; i += batchSize) {
      const batch = tickets.slice(i, i + batchSize);
      await Ticket.insertMany(batch, { ordered: false });
    }

    return res.status(200).json({
      success: true,
      inserted: tickets.length,
      startTicket: `TKT${String(startNumber).padStart(6, "0")}`,
      endTicket: `TKT${String(startNumber + totalRecords - 1).padStart(
        6,
        "0"
      )}`,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  addWorkLog,
  getTicketDropdown,
  insertBulkTickets,
};