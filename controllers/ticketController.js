const Ticket = require("../models/ticket.model");
const asyncHandler = require("../middleware/asyncHandler");
const uploadFile = require("../services/uploadFile");
const ApiError = require("../utils/ApiError");
const { convertStringFormatDateTime, convertStringToDateTime } = require("../utils/dateFormatter");
const { format } = require("@fast-csv/format");
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
  // const attachments = await Promise.all(
  //   (req.files || []).map((file) =>
  //     uploadFile(file, `Tickets/${ticketId}`)
  //   )
  // );
  const uploadedBy =
    req.body.createdByName ||
    req.body.updatedByName ||
    "System";

  const role = req.body.createdBy

  const attachments = await Promise.all(
    (req.files || []).map(async (file) => {
      const url = await uploadFile(
        file,
        `Tickets/${ticketId}`
      );

      return {
        url,
        role: role,
        uploadedBy,
        uploadedAt: convertStringFormatDateTime(new Date()),
      };
    })
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

  if (req.query.search) {
    query.$or = [
      { ticketId: { $regex: req.query.search, $options: "i" } },
      { title: { $regex: req.query.search, $options: "i" } },
      { description: { $regex: req.query.search, $options: "i" } },
      { "propertyId.propertyCode": { $regex: req.query.search, $options: "i" } },
      { "propertyId.propertyLocation": { $regex: req.query.search, $options: "i" } },
    ];
  }

  if (req.query.status) query.status = req.query.status;
  if (req.query.priority) query.priority = req.query.priority;
  if (req.query.category) query.category = req.query.category;
  if (req.query.department) query.department = req.query.department;
  if (req.query.assignee) query.assignee = req.query.assignee;
  if (req.query.customerImpacted) query.customerImpacted = req.query.customerImpacted;
  if (req.query.escalated) query.escalated = req.query.escalated;
  if (req.query.manager) query.manager = req.query.manager;

  if (req.query.lateStatus === "LateAcknowledged") {
    query.lateAcknowledged = "Yes";
  }

  if (req.query.lateStatus === "LateResolved") {
    query.lateResolved = "Yes";
  }

  if (req.query.dateFrom || req.query.dateTo) {
    query.createdAt = {};

    if (req.query.dateFrom) {
      const fromDate = new Date(req.query.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      query.createdAt.$gte = fromDate;
    }

    if (req.query.dateTo) {
      const toDate = new Date(req.query.dateTo);
      toDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(toDate);
      nextDay.setDate(nextDay.getDate() + 1);

      query.createdAt.$lt = nextDay;
    }
  }

  if (req.query.propertyCode) {
    query["propertyId.propertyCode"] = {
      $regex: req.query.propertyCode,
      $options: "i",
    };
  }

  if (req.query.propertyLocation) {
    query["propertyId.propertyLocation"] = {
      $regex: req.query.propertyLocation,
      $options: "i",
    };
  }

  const pipeline = [
    {
      $lookup: {
        from: "properties",
        let: { propertyId: "$propertyId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$propertyId"],
              },
            },
          },
          {
            $project: {
              _id: 1,
              propertyCode: 1,
              propertyLocation: 1,
            },
          },
        ],
        as: "propertyId",
      },
    },
    {
      $unwind: {
        path: "$propertyId",
        preserveNullAndEmptyArrays: true,
      },
    },
    { $match: query },
    { $sort: { createdAt: -1, _id:-1 } },
    { $skip: skip },
    { $limit: limit },
  ];

  const tickets = await Ticket.aggregate(pipeline);

  const countPipeline = [
    {
      $lookup: {
        from: "properties",
        let: { propertyId: "$propertyId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$propertyId"],
              },
            },
          },
          {
            $project: {
              _id: 1,
              propertyCode: 1,
              propertyLocation: 1,
            },
          },
        ],
        as: "propertyId",
      },
    },
    {
      $unwind: {
        path: "$propertyId",
        preserveNullAndEmptyArrays: true,
      },
    },
    { $match: query },
    { $count: "total" },
  ];

  const countResult = await Ticket.aggregate(countPipeline);

  const totalRecords = countResult[0]?.total || 0;
  const totalPages = Math.ceil(totalRecords / limit);

  res.status(200).json({
    success: true,
    page,
    limit,
    totalRecords,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    count: tickets.length,
    data: tickets,
  });
});

const getTicketById = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate({
      path: "propertyId",
      select: "_id propertyCode propertyLocation",
    });

  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  res.status(200).json({
    success: true,
    data: ticket,
  });
});

// const getTicketNavigation = asyncHandler(async (req, res) => {
//   const currentTicket = await Ticket.findById(req.params.id);

//   if (!currentTicket) {
//     throw new ApiError(404, "Ticket not found");
//   }

//   // Same query as getAllTickets
//   const query = {};

//   if (req.query.search) {
//     query.$or = [
//       {
//         ticketId: {
//           $regex: req.query.search,
//           $options: "i",
//         },
//       },
//       {
//         title: {
//           $regex: req.query.search,
//           $options: "i",
//         },
//       },
//       {
//         description: {
//           $regex: req.query.search,
//           $options: "i",
//         },
//       },
//       {
//         propertyCode: {
//           $regex: req.query.search,
//           $options: "i",
//         },
//       },
//     ];
//   }

//   if (req.query.status) query.status = req.query.status;
//   if (req.query.priority) query.priority = req.query.priority;
//   if (req.query.category) query.category = req.query.category;
//   if (req.query.department) query.department = req.query.department;
//   if (req.query.assignee) query.assignee = req.query.assignee;
//   if (req.query.manager) query.manager = req.query.manager;
//   if (req.query.propertyCode) query.propertyCode = req.query.propertyCode;
//   if (req.query.propertyLocation)
//     query.propertyLocation = req.query.propertyLocation;
//   if (req.query.customerImpacted)
//     query.customerImpacted = req.query.customerImpacted;
//   if (req.query.escalated)
//     query.escalated = req.query.escalated;

//   if (req.query.lateStatus === "LateAcknowledged") {
//     query.lateAcknowledged = "Yes";
//   }

//   if (req.query.lateStatus === "LateResolved") {
//     query.lateResolved = "Yes";
//   }

//   // Same order as Ticket List
//   const tickets = await Ticket.find(query)
//     .sort({ createdAt: -1 })
//     .select("_id");

//   const currentIndex = tickets.findIndex(
//     (t) => t._id.toString() === req.params.id
//   );

//   const previousId =
//     currentIndex > 0
//       ? tickets[currentIndex - 1]._id
//       : null;

//   const nextId =
//     currentIndex < tickets.length - 1
//       ? tickets[currentIndex + 1]._id
//       : null;

//   res.status(200).json({
//     success: true,
//     previousId,
//     nextId,
//   });
// });
const getTicketNavigation = asyncHandler(async (req, res) => {
  const currentTicket = await Ticket.findById(req.params.id)
    .select("_id createdAt")
    .lean();

  if (!currentTicket) {
    throw new ApiError(404, "Ticket not found");
  }

  const query = {};

  if (req.query.search) {
    query.$or = [
      { ticketId: { $regex: req.query.search, $options: "i" } },
      { title: { $regex: req.query.search, $options: "i" } },
      { description: { $regex: req.query.search, $options: "i" } },
      { propertyCode: { $regex: req.query.search, $options: "i" } },
    ];
  }

  if (req.query.status) query.status = req.query.status;
  if (req.query.priority) query.priority = req.query.priority;
  if (req.query.category) query.category = req.query.category;
  if (req.query.department) query.department = req.query.department;
  if (req.query.assignee) query.assignee = req.query.assignee;
  if (req.query.manager) query.manager = req.query.manager;
  if (req.query.propertyCode) query.propertyCode = req.query.propertyCode;
  if (req.query.propertyLocation)
    query.propertyLocation = req.query.propertyLocation;
  if (req.query.customerImpacted)
    query.customerImpacted = req.query.customerImpacted;
  if (req.query.escalated)
    query.escalated = req.query.escalated;

  if (req.query.lateStatus === "LateAcknowledged") {
    query.lateAcknowledged = "Yes";
  }

  if (req.query.lateStatus === "LateResolved") {
    query.lateResolved = "Yes";
  }

  const currentCreatedAt = currentTicket.createdAt;
  const currentId = currentTicket._id;

  // Previous = next newer ticket in table order
  const previousTicket = await Ticket.findOne({
    ...query,
    $or: [
      {
        createdAt: { $gt: currentCreatedAt },
      },
      {
        createdAt: currentCreatedAt,
        _id: { $gt: currentId },
      },
    ],
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("_id")
    .lean();

  // Next = next older ticket in table order
  const nextTicket = await Ticket.findOne({
    ...query,
    $or: [
      {
        createdAt: { $lt: currentCreatedAt },
      },
      {
        createdAt: currentCreatedAt,
        _id: { $lt: currentId },
      },
    ],
  })
    .sort({ createdAt: -1, _id: -1 })
    .select("_id")
    .lean();

  res.status(200).json({
    success: true,
    previousId: previousTicket?._id || null,
    nextId: nextTicket?._id || null,
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

  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  const newStatus = req.body.status;

  const acknowledgeData = calculateAcknowledged(ticket, newStatus);
  const resolveData = calculateResolved(ticket, newStatus);
  const user =
    req.body.updatedByName ||
    req.body.createdByName ||
    "System";
  const role = req.body.createdBy
  // ================= Attachments =================

  let attachments = [];

  if (req.body.existingAttachments) {
    attachments = JSON.parse(req.body.existingAttachments);
  }

  delete req.body.existingAttachments;

  if (req.files?.length) {
    // const uploadedFiles = await Promise.all(
    //   req.files.map((file) =>
    //     uploadFile(file, `Tickets/${ticket.ticketId}`)
    //   )
    // );

    // attachments = [...attachments, ...uploadedFiles];
    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        const url = await uploadFile(
          file,
          `Tickets/${ticket.ticketId}`
        );

        return {
          url,
          role: role,
          uploadedBy: user,
          uploadedAt: convertStringFormatDateTime(new Date()),
        };
      })
    );

    attachments = [...attachments, ...uploadedFiles];
  }

  // ================= Auditor Logs =================

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
      createdBy: req.body.updatedByName || "System",
      createdAt: convertStringFormatDateTime(new Date()),
    });
  }

  // ================= Work Logs =================

  let workLogs = ticket.workLogs || [];



  // Sarv changes eka array madhe collect karu
  const changes = [];
  // ================= Deleted Attachments =================

  const oldAttachments = ticket.attachment || [];
  const currentAttachments = attachments || [];

  const getUrl = (item) =>
    typeof item === "string" ? item : item?.url;

  const deletedAttachments = oldAttachments.filter((oldFile) => {
    const oldUrl = getUrl(oldFile);

    return !currentAttachments.some(
      (newFile) => getUrl(newFile) === oldUrl
    );
  });

  if (deletedAttachments.length > 0) {
    const deletedNames = deletedAttachments
      .map((file) => {
        const url = getUrl(file);
        return decodeURIComponent(url.split("/").pop());
      })
      .join(", ");

    changes.push(
      `Deleted ${deletedAttachments.length} attachment(s): ${deletedNames}`
    );
  }
  const fields = [
    { key: "status", label: "Status" },
    { key: "priority", label: "Priority" },
    { key: "department", label: "Department" },
    { key: "category", label: "Category" },
    { key: "manager", label: "Manager" },
    { key: "ticketManager", label: "Ticket Manager" },
    { key: "assignee", label: "Assignee" },
    { key: "propertyCode", label: "Property" },
    { key: "propertyLocation", label: "Property Location" },
    { key: "customerImpacted", label: "Customer Impacted" },
    { key: "escalated", label: "Escalated" },
    { key: "title", label: "Title" },
    { key: "description", label: "Description" },
    { key: "actualTimeSpent", label: "Actual Time" },
  ];

  fields.forEach(({ key, label }) => {
    const oldValue = ticket[key] ?? "";
    const newValue = req.body[key];

    if (
      newValue !== undefined &&
      String(oldValue) !== String(newValue)
    ) {
      changes.push(
        `${label} changed from "${oldValue || "Blank"}" to "${newValue}"`
      );
    }
  });

  // Target Date
  if (
    req.body.targetDate &&
    String(ticket.targetDate || "") !==
    String(req.body.targetDate)
  ) {
    changes.push(
      `Target Date changed from "${ticket.targetDate || "Blank"}" to "${req.body.targetDate}"`
    );
  }

  // Attachment Upload
  // if (req.files?.length) {
  //   changes.push(
  //     `${req.files.length} attachment(s) uploaded`
  //   );
  // }
  if (req.files?.length) {
    const names = req.files
      .map((x) => x.originalname)
      .join(", ");

    changes.push(
      `uploaded ${req.files.length} attachment(s): ${names}`
    );
  }
  // Auditor Log Add
  if (auditorMessage) {
    changes.push(`Auditor Log added`);
  }

  // Manual Work Log (Add WorkLog field)
  const newWorkLog = String(req.body.newWorkLog || "").trim();

  if (newWorkLog) {
    workLogs.push({
      message: newWorkLog,
      createdBy: user,
      createdAt: convertStringFormatDateTime(new Date()),
    });
  }

  // Ekach WorkLog create kara
  if (changes.length > 0) {
    workLogs.push({
      message: changes.join("\n"),
      createdBy: user,
      createdAt: convertStringFormatDateTime(new Date()),
    });
  }

  // ================= Update Ticket =================

  const updatedTicket = await Ticket.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,

      attachment: attachments,

      auditorLogs,

      workLogs,

      updatedDateTime: convertStringFormatDateTime(
        new Date()
      ),

      acknowledgedDate:
        acknowledgeData.acknowledgedDate,

      lateAcknowledged:
        acknowledgeData.lateAcknowledged,

      lateResolved:
        resolveData.lateResolved,
    },
    {
      returnDocument: "after",
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
      returnDocument: "after",
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

const exportTickets = asyncHandler(async (req, res) => {
  try {
    const {
      search = "",
      filters = {},
      ticketIds = [],
      columns = [],
    } = req.body;

    const query = {};

    // =========================
    // SEARCH
    // =========================
    if (search?.trim()) {
      const searchRegex = {
        $regex: search.trim(),
        $options: "i",
      };

      query.$or = [
        { ticketId: searchRegex },
        { title: searchRegex },
        { propertyCode: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { priority: searchRegex },
        { status: searchRegex },
        { department: searchRegex },
        { manager: searchRegex },
        { assignee: searchRegex },
      ];
    }

    // =========================
    // FILTERS
    // =========================

    if (filters.propertyCode) {
      query.propertyCode = filters.propertyCode;
    }

    if (filters.Location) {
      query.propertyLocation = filters.Location;
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.department) {
      query.department = filters.department;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.assignee) {
      query.assignee = filters.assignee;
    }

    if (filters.manager) {
      query.manager = filters.manager;
    }

    if (filters.customerImpacted) {
      query.customerImpacted = filters.customerImpacted;
    }

    if (filters.escalated) {
      query.escalated = filters.escalated;
    }

    if (filters.lateStatus === "LateAcknowledged") {
      query.lateAcknowledged = "Yes";
    }

    if (filters.lateStatus === "LateResolved") {
      query.lateResolved = "Yes";
    }

    // =========================
    // SELECTED TICKETS
    // =========================

    if (Array.isArray(ticketIds) && ticketIds.length > 0) {
      query.ticketId = {
        $in: ticketIds,
      };
    }

    // =========================
    // EXPORT COLUMNS
    // =========================

    const defaultColumns = [
      "ticketId",
      "dateCreated",
      "propertyCode",
      "title",
      "status",
      "customerImpacted",
      "escalated",
      "targetDate",
      "category",
      "priority",
      "department",
      "manager",
      "ticketManager",
      "assignee",
      "bedNo",
      "roomNo",
      "createdBy",
      "propertyLocation",
    ];

    const exportColumns =
      Array.isArray(columns) && columns.length > 0
        ? columns
        : defaultColumns;

    // =========================
    // CSV HEADERS
    // =========================

    const headerMap = {
      ticketId: "Ticket ID",
      dateCreated: "Date Created",
      propertyCode: "Property Code",
      title: "Title",
      status: "Status",
      customerImpacted: "Customer Impacted",
      escalated: "Escalated",
      targetDate: "Target Date",
      category: "Category",
      priority: "Priority",
      department: "Department",
      manager: "Manager",
      ticketManager: "Ticket Manager",
      assignee: "Assignee",
      bedNo: "Bed No",
      roomNo: "Room No",
      createdBy: "Created By",
      propertyLocation: "Location",
    };

    const headers = exportColumns.map(
      (column) => headerMap[column] || column
    );

    // =========================
    // RESPONSE HEADERS
    // =========================

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tickets-${new Date()
        .toISOString()
        .split("T")[0]}.csv"`
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");

    // =========================
    // CSV STREAM
    // =========================

    const csvStream = format({
      headers,
    });

    csvStream.pipe(res);

    // =========================
    // MONGODB CURSOR
    // =========================

    const cursor = Ticket.find(query)
      .select(exportColumns.join(" "))
      .lean()
      .cursor();

    // =========================
    // STREAM DATA
    // =========================

    for await (const ticket of cursor) {
      const row = {};

      exportColumns.forEach((column) => {
        let value = ticket[column];

        if (value === null || value === undefined) {
          value = "";
        }

        // Date handling
        if (value instanceof Date) {
          value = value.toISOString();
        }

        // Array / Object handling
        if (typeof value === "object") {
          value = JSON.stringify(value);
        }

        row[headerMap[column] || column] = value;
      });

      csvStream.write(row);
    }

    csvStream.end();

  } catch (error) {
    console.error("Export Tickets Error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to export tickets",
        error: error.message,
      });
    }

    res.end();
  }
});

module.exports = {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  addWorkLog,
  getTicketDropdown,
  insertBulkTickets,
  getTicketNavigation,
  exportTickets
};