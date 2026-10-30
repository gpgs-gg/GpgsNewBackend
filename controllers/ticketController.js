const Ticket = require("../models/ticket.model");
const asyncHandler = require("../middleware/asyncHandler");
const uploadFile = require("../services/uploadFile");
const ApiError = require("../utils/ApiError");
const { convertStringFormatDateTime, convertStringToDateTime } = require("../utils/dateFormatter");
const { format } = require("@fast-csv/format");
const PDFDocument = require("pdfkit");
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

const getAllTickets = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 10, 1);
  const skip = (page - 1) * limit;

  const query = {};
  const getFilterValue = (value) => {
    if (value && typeof value === "object") {
      return value.value ?? value.label ?? "";
    }

    return value;
  };

  if (req.query.search) {
    query.$or = [
      { ticketId: { $regex: req.query.search, $options: "i" } },
      { title: { $regex: req.query.search, $options: "i" } },
      { description: { $regex: req.query.search, $options: "i" } },
      {
        "propertyId.propertyCode": { $regex: req.query.search, $options: "i" },
      },
      {
        "propertyId.propertyLocation": {
          $regex: req.query.search,
          $options: "i",
        },
      },
    ];
  }
  if (req.query.createdBy) {
    const createdBy = getFilterValue(req.query.createdBy);

    query.$and = [
      ...(query.$and || []),
      {
        $or: [
          { createdBy: { $regex: createdBy, $options: "i" } },
          { createdByName: { $regex: createdBy, $options: "i" } },
        ],
      },
    ];
  }
const rawStatus = req.query.status ?? req.query["status[]"];

  if (rawStatus) {
    const statuses = (Array.isArray(rawStatus) ? rawStatus : [rawStatus])
      .flatMap((status) => String(status).split(","))
      .map((status) => status.trim())
      .filter(Boolean);

    if (statuses.length > 0) {
      query.status = { $in: statuses };
    }
  }

  if (req.query.priority) {
    query.priority = getFilterValue(req.query.priority);
  }

  if (req.query.category) {
    query.category = getFilterValue(req.query.category);
  }

  if (req.query.department) {
    query.department = getFilterValue(req.query.department);
  }

  if (req.query.assignee) {
    query.assignee = getFilterValue(req.query.assignee);
  }

  if (req.query.customerImpacted) {
    query.customerImpacted = getFilterValue(req.query.customerImpacted);
  }

  if (req.query.escalated) {
    query.escalated = getFilterValue(req.query.escalated);
  }

  if (req.query.manager) {
    query.manager = getFilterValue(req.query.manager);
  }

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
    const propertyCode = getFilterValue(req.query.propertyCode);

    query["propertyId.propertyCode"] = {
      $regex: propertyCode,
      $options: "i",
    };
  }

  if (req.query.propertyLocation) {
    const propertyLocation = getFilterValue(req.query.propertyLocation);

    query["propertyId.propertyLocation"] = {
      $regex: propertyLocation,
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
    { $sort: { createdAt: -1, _id: -1 } },
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
    } else if (hour >= 19) {
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
    const acknowledgedDate = convertStringToDateTime(ticket.dateCreated);
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
          slaHours = 4;
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
  const user = req.body.createdByName || req.body.updatedByName || "System";
  const role = req.body.createdBy || req.body.role

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
      createdBy: worklogsAddedBy || "System",
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
      role: role,
      createdAt: convertStringFormatDateTime(new Date()),
    });
  }

  // Ekach WorkLog create kara
  if (changes.length > 0) {
    workLogs.push({
      message: changes.join("\n"),
      createdBy: user,
      role: role,
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
      "description",
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
      Array.isArray(columns) && columns.length > 0 ? columns : defaultColumns;

    // =========================
    // CSV HEADERS
    // =========================

    const headerMap = {
      ticketId: "Ticket ID",
      dateCreated: "Date Created",
      propertyCode: "Property Code",
      title: "Title",
      status: "Status",
      description: "Description",
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

    const headers = exportColumns.map((column) => headerMap[column] || column);

    // =========================
    // RESPONSE HEADERS
    // =========================

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tickets-${
        new Date().toISOString().split("T")[0]
      }.csv"`,
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
      .select([...new Set([...exportColumns, "propertyId"])].join(" "))
      .populate({
        path: "propertyId",
        select: "propertyCode propertyLocation",
      })
      .lean()
      .cursor();

    // =========================
    // STREAM DATA
    // =========================

    try {
      for await (const ticket of cursor) {
        const row = {};

        exportColumns.forEach((column) => {
          let value;

          // Get property details from the populated property document
          if (column === "propertyCode") {
            value = ticket.propertyId?.propertyCode;
          } else if (column === "propertyLocation" || column === "Location") {
            value = ticket.propertyId?.propertyLocation;
          } else {
            value = ticket[column];
          }

          if (value === null || value === undefined) {
            value = "";
          }

          if (value instanceof Date) {
            value = value.toISOString();
          } else if (typeof value === "object") {
            value = JSON.stringify(value);
          }

          row[headerMap[column] || column] = value;
        });

        csvStream.write(row);
      }

      // End the stream only once, after every ticket is written
      csvStream.end();
    } catch (error) {
      cursor.close().catch(() => {});

      console.error("Ticket CSV streaming error:", error);

      if (!res.headersSent) {
        res.status(500).end("Failed to export tickets");
      } else {
        res.destroy(error);
      }
    }

    // =========================
    // STREAM DATA
    // =========================

    for await (const ticket of cursor) {
      const row = {};
      // =========================
      // MONGODB CURSOR
      // =========================

      const cursor = Ticket.find(query)
        .select([...exportColumns, "propertyId"].join(" "))
        .populate({
          path: "propertyId",
          select: "propertyCode propertyLocation",
        })
        .lean()
        .cursor();

      // =========================
      // STREAM DATA
      // =========================

      for await (const ticket of cursor) {
        const row = {};

        exportColumns.forEach((column) => {
          let value;

          // Property details come from the populated property document
          if (column === "propertyCode") {
            value = ticket.propertyId?.propertyCode;
          } else if (column === "propertyLocation") {
            value = ticket.propertyId?.propertyLocation;
          } else {
            value = ticket[column];
          }

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

const sanitizePDFText = (value) => {
  if (value === null || value === undefined) {
    return "-";
  }

  return String(value)
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\uFFFD/g, "");
};

const exportTicketsPDF = async (req, res) => {
  try {
    const {
      search = "",
      filters = {},
      ticketIds = [],
      columns = [],
      createdBy = "",
    } = req.body;

    const query = {};

    // =========================
    // SEARCH
    // Keep these fields consistent with your CSV export
    // =========================
    if (search.trim()) {
      const regex = {
        $regex: search.trim(),
        $options: "i",
      };

      query.$or = [
        { ticketId: regex },
        { title: regex },
        { propertyCode: regex },
        { description: regex },
        { category: regex },
        { priority: regex },
        { status: regex },
        { department: regex },
        { manager: regex },
        { assignee: regex },
      ];
    }

    // =========================
    // FILTERS
    // Use the same filter mapping as exportTickets
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

    if (filters.escalated !== undefined && filters.escalated !== "") {
      query.escalated = filters.escalated;
    }

    // Apply late-status filter according to your existing CSV logic.
    if (filters.lateStatus) {
      if (filters.lateStatus === "Late Acknowledged") {
        query.lateAcknowledged = true;
      } else if (filters.lateStatus === "Late Resolved") {
        query.lateResolved = true;
      }
    }

    // =========================
    // CREATOR TAB
    // =========================
    if (createdBy && createdBy !== "all") {
      query.createdBy = createdBy === "Clients" ? "Client" : createdBy;
    }

    // =========================
    // SELECTED TICKETS
    // =========================
    if (Array.isArray(ticketIds) && ticketIds.length > 0) {
      query.ticketId = { $in: ticketIds };
    }

    // =========================
    // ALLOWED COLUMNS
    // =========================
    const defaultColumns = [
      "ticketId",
      "dateCreated",
      "propertyCode",
      "title",
      "description",
      "status",
      "customerImpacted",
      "escalated",
      "targetDate",
      "category",
      "priority",
      "bedNo",
      "roomNo",
      "department",
      "manager",
      "assignee",
      "createdById",
      "createdByName",
      "createdBy",
      "updatedById",
      "updatedByName",
      "updatedDateTime",
      "internalComments",
      "estimatedTimeToResolve",
      "actualTimeSpent",
      "propertyLocation",
      "lateAcknowledged",
      "lateResolved",
    ];

    const exportColumns =
      Array.isArray(columns) && columns.length
        ? columns.filter((column) => defaultColumns.includes(column))
        : defaultColumns;

    if (exportColumns.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid columns selected for export.",
      });
    }

    const headerMap = {
      ticketId: "Ticket ID",
      dateCreated: "Date Created",
      propertyCode: "Property Code",
      title: "Title",
      description: "Description",
      status: "Status",
      customerImpacted: "Customer Impacted",
      escalated: "Escalated",
      targetDate: "Target Date",
      category: "Category",
      priority: "Priority",
      bedNo: "Bed No",
      roomNo: "Room No",
      department: "Department",
      manager: "Manager",
      assignee: "Assignee",
      createdById: "Created By ID",
      createdByName: "Created By Name",
      createdBy: "Created By Role",
      updatedById: "Updated By ID",
      updatedByName: "Updated By Name",
      updatedDateTime: "Updated Date",
      internalComments: "Internal Comments",
      estimatedTimeToResolve: "Estimated Time",
      actualTimeSpent: "Actual Time",
      propertyLocation: "Property Location",
      lateAcknowledged: "Late Acknowledged",
      lateResolved: "Late Resolved",
    };

    // =========================
    // FETCH ALL MATCHING TICKETS
    // =========================
    const records = await Ticket.find(query)
      .populate({
        path: "propertyId",
        select: "propertyCode propertyLocation",
      })
      .sort({ createdAt: -1 })
      .lean();

    const filename = `tickets-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // =========================
    // PDF SETUP
    // =========================
    const doc = new PDFDocument({
      size: "A3",
      layout: "landscape",
      margins: {
        top: 35,
        bottom: 35,
        left: 25,
        right: 25,
      },
      bufferPages: false,
    });

    doc.pipe(res);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const titleWidth = 180;
    const descriptionWidth = 300;

    const remainingWidth =
      pageWidth -
      (exportColumns.includes("title") ? titleWidth : 0) -
      (exportColumns.includes("description") ? descriptionWidth : 0);

    const remainingColumnCount = exportColumns.filter(
      (column) => column !== "title" && column !== "description",
    ).length;

    const defaultColumnWidth =
      remainingColumnCount > 0 ? remainingWidth / remainingColumnCount : 0;

    const columnWidths = exportColumns.map((column) => {
      if (column === "title") return titleWidth;
      if (column === "description") return descriptionWidth;

      return defaultColumnWidth;
    });

    const getRowHeight = (record) => {
      doc.font("Helvetica").fontSize(6.5);

      const textPadding = 10;

      const maxTextHeight = Math.max(
        ...exportColumns.map((column, index) => {
          let rawValue = record[column];

          if (column === "propertyCode") {
            rawValue = record.propertyId?.propertyCode ?? record.propertyCode;
          }

          if (column === "propertyLocation") {
            rawValue =
              record.propertyId?.propertyLocation ?? record.propertyLocation;
          }

          const value = formatValue(column, rawValue);
          const width = columnWidths[index] - 4;

          return doc.heightOfString(value, {
            width,
            lineBreak: true,
          });
        }),
      );

return Math.max(34, Math.ceil(maxTextHeight + textPadding + 4));
    };

    const drawHeader = () => {
      const headerHeight = 50;

      doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827");

      doc.text("Tickets Report", {
        align: "center",
      });

      doc.moveDown(0.5);

      doc.font("Helvetica").fontSize(8).fillColor("#374151");

      doc.text(
        `Generated: ${new Date().toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}`,
      );

      doc.moveDown();

      const startX = doc.page.margins.left;
      const startY = doc.y;

      doc.save();
      doc.rect(startX, startY, pageWidth, headerHeight).fill("#e5e7eb");
      doc.restore();

      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#111827");

      exportColumns.forEach((column, index) => {
        const columnX =
          startX +
          columnWidths.slice(0, index).reduce((sum, width) => sum + width, 0);

        doc.text(headerMap[column] || column, columnX + 2, startY + 5, {
          width: columnWidths[index] - 4,
          height: headerHeight - 10,
          lineBreak: true,
        });
      });

      doc.y = startY + headerHeight;
    };

    const formatValue = (column, value) => {
      if (value === null || value === undefined || value === "") {
        return "-";
      }

      if (["dateCreated", "targetDate", "updatedDateTime"].includes(column)) {
        const date = new Date(value);

        return Number.isNaN(date.getTime())
          ? "-"
          : date.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "Asia/Kolkata",
            });
      }

      if (typeof value === "boolean") {
        return value ? "Yes" : "No";
      }

      if (typeof value === "number") {
        return value.toLocaleString("en-IN");
      }

      if (Array.isArray(value)) {
        return value
          .map((item) =>
            typeof item === "object" && item !== null
              ? JSON.stringify(item)
              : String(item),
          )
          .join(", ");
      }

      if (typeof value === "object") {
        return (
          value.name || value.fullName || value._id || JSON.stringify(value)
        );
      }

  return sanitizePDFText(value);
    };

    // =========================
    // DRAW PDF TABLE
    // =========================
    drawHeader();

    let rowIndex = 0;

    for (const record of records) {
      const rowHeight = getRowHeight(record);

      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        drawHeader();
      }

      const startX = doc.page.margins.left;
      const startY = doc.y;

      if (rowIndex % 2 === 0) {
        doc.save();
        doc.rect(startX, startY, pageWidth, rowHeight).fill("#f9fafb");
        doc.restore();
      }

      doc.font("Helvetica").fontSize(6.5).fillColor("#111827");

      exportColumns.forEach((column, index) => {
        let rawValue = record[column];

        // Property details may be stored on the populated property.
        if (column === "propertyCode") {
          rawValue = record.propertyId?.propertyCode ?? record.propertyCode;
        }

        if (column === "propertyLocation") {
          rawValue =
            record.propertyId?.propertyLocation ?? record.propertyLocation;
        }

        let value = formatValue(column, rawValue);

        const columnX =
          startX +
          columnWidths.slice(0, index).reduce((sum, width) => sum + width, 0);

        doc.text(value, columnX + 2, startY + 5, {
          width: columnWidths[index] - 4,
          lineBreak: true,
        });
      });

      doc
        .moveTo(startX, startY + rowHeight)
        .lineTo(startX + pageWidth, startY + rowHeight)
        .lineWidth(0.3)
        .strokeColor("#d1d5db")
        .stroke();

      doc.y = startY + rowHeight;
      rowIndex++;
    }

    if (rowIndex === 0) {
      doc.font("Helvetica").fontSize(12).fillColor("#111827");

      doc.text("No tickets found.", {
        align: "center",
      });
    }

    doc.end();
  } catch (error) {
    console.error("Export Tickets PDF Error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to export tickets PDF.",
      });
    }

    res.end();
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
  getTicketNavigation,
  exportTickets,
  exportTicketsPDF
};