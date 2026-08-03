const Lead = require("../models/leads.model");
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");
const {
  convertStringFormatDateTime,
} = require("../utils/dateFormatter");
const GlobalSettings = require("../models/gobalSettings.model");
const OptionsData = require("../models/options.model");



// ================= DYNAMIC TEAM CODES COMMON FUNCTION =================

const getTeamCodes = async () => {
  const teamOption = await OptionsData.findOne({
    categoryKey: "teamcode",
  }).lean();

  if (!teamOption) {
    return [];
  }

  return teamOption.items
    .filter((item) => item.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((item) => item.value);
};
// ================= CREATE LEAD =================
const createLead = asyncHandler(async (req, res) => {
  const today = new Date()
    .toISOString()
    .split("T")[0];
  const currentTime = new Date()
    .toLocaleTimeString();

  const existingLead = await Lead.findOne({
    CallingNo: req.body.CallingNo,
    isActive: true
  });

  if (existingLead) {
    if (existingLead.Date === today) {
      throw new ApiError(
        400,
        "This lead already exists today"
      );
    }

    const lastLead = await Lead.findOne()
      .sort({ LeadNo: -1 })
      .select("LeadNo");
    const LeadNo = lastLead
      ? lastLead.LeadNo + 1
      : 1;

    const updatedLead =
      await Lead.findByIdAndUpdate(
        existingLead._id,
        {
          LeadNo,
          Date: today,
          Time: currentTime
        },
        {
          returnDocument: "after"
        }
      );

    return res.status(200).json({
      success: true,
      message: "Lead updated for new day",
      data: updatedLead
    });
  }
  const lastLead = await Lead.findOne()
    .sort({ LeadNo: -1 })
    .select("LeadNo TeamCode");

  const LeadNo = lastLead
    ? lastLead.LeadNo + 1
    : 1;
  let TeamCode = req.body.TeamCode || "";
  if (!TeamCode) {
    const teamCodes = await getTeamCodes();
    if (teamCodes.length) {
      const currentIndex = teamCodes.indexOf(lastLead?.TeamCode);
      // First lead
      TeamCode = teamCodes[0];
      // Next team
      if (currentIndex !== -1) {
        TeamCode =
          teamCodes[(currentIndex + 1) % teamCodes.length];
      }
    }
  }
  const workLogs = [];
  const messages = [];
  // Default Create Log
  messages.push("Lead Created");
  // User Comment
  if (req.body.Comments && req.body.Comments.trim()) {
    messages.push(req.body.Comments.trim());
  }
  if (messages.length) {
    workLogs.push({
      message: messages.join("\n"),
      createdBy: req.body.CreatedBy || "System",
      createdAt: new Date(),
    });
  }

  // Comments DB मध्ये save होऊ देऊ नका
  const { Comments, CreatedBy, ...leadData } = req.body;

  const lead = await Lead.create({
    ...leadData,
    LeadNo,
    TeamCode,
    Date: today,
    Time: currentTime,
    workLogs,
    CreatedBy,
  });
  res.status(201).json({
    success: true,
    message: "Lead created successfully",
    data: lead
  });
});


const bulkCreateLead = asyncHandler(async (req, res) => {
  const leads = req.body.leads;

  if (!Array.isArray(leads) || !leads.length) {
    throw new ApiError(400, "No leads found");
  }

  const today = new Date().toISOString().split("T")[0];
  const time = new Date().toLocaleTimeString();

  const settings = await GlobalSettings.findOne().lean();

  const teamAutoAssignment =
    settings?.teamAutoAssignment ?? true;

  const lastLead = await Lead.findOne()
    .sort({ LeadNo: -1 })
    .select("LeadNo TeamCode");

  let teamCodes = [];
  let teamIndex = 0;

  if (teamAutoAssignment) {
    teamCodes = await getTeamCodes();

    if (lastLead) {
      const currentIndex = teamCodes.indexOf(lastLead.TeamCode);

      if (currentIndex !== -1) {
        teamIndex = (currentIndex + 1) % teamCodes.length;
      }
    }
  }

  let startNo = lastLead ? lastLead.LeadNo + 1 : 1;

  const callingNumbers = leads.map((x) => x.CallingNo);

  const existingLeads = await Lead.find({
    CallingNo: { $in: callingNumbers },
    isActive: true
  });

  const existingMap = new Map();

  existingLeads.forEach((item) => {
    existingMap.set(item.CallingNo, item);
  });

  const insertData = [];
  const updateData = [];

  leads.forEach((item) => {
    const oldLead = existingMap.get(item.CallingNo,);

    if (oldLead) {
      // Same day duplicate -> Skip
      if (oldLead.Date === today) {
        return;
      }

      // Previous day -> Update
      updateData.push({
        id: oldLead._id,
        LeadNo: startNo++,
        Date: today,
        Time: time,
      });

      return;
    }

    insertData.push({
      ...item,
      LeadNo: startNo++,
      TeamCode:
        teamAutoAssignment && teamCodes.length
          ? teamCodes[teamIndex]
          : "",
      Date: today,
      Time: time,
      WhatsAppNo: item.WhatsAppNo || item.CallingNo,
      LeadStatus: item.LeadStatus || "New",
      FollowupDate: item.FollowupDate || "",
    });

    if (teamAutoAssignment && teamCodes.length) {
      teamIndex = (teamIndex + 1) % teamCodes.length;
    }
  });

  // Update existing leads
  for (const item of updateData) {
    await Lead.findByIdAndUpdate(item.id, {
      LeadNo: item.LeadNo,
      Date: item.Date,
      Time: item.Time,
    });
  }

  // Insert new leads
  let result = [];

  if (insertData.length) {
    result = await Lead.insertMany(insertData);
  }

  res.status(201).json({
    success: true,
    message: "Bulk leads processed successfully",
    inserted: result.length,
    updated: updateData.length,
    skipped: leads.length - (result.length + updateData.length),
    count: result.length + updateData.length,
    data: result,
  });
});

// ================= GET ALL LEADS =================
const getAllLeads = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 10, 1);
  const skip = (page - 1) * limit;
  const query = { IsActive: true, };
  // Search
  if (req.query.search) {
    const search = req.query.search;
    query.$or = [
      { ClientName: { $regex: search, $options: "i" } },
      { CallingNo: { $regex: search, $options: "i" } },
      { WhatsAppNo: { $regex: search, $options: "i" } },
      { LeadSource: { $regex: search, $options: "i" } },
    ];
    if (!isNaN(search)) {
      query.$or.push({
        LeadNo: Number(search),
      });
    }
  }
  // Filters
  // Created Date Range
  // ================= DEFAULT FILTER =================
  if (req.query.defaultFilter === "true") {
    // query.Assignee = req.query.Assignee;
    query.$or = [
      {
        Date: {
          $gte: req.query.DateFrom,
          $lte: req.query.DateTo,
        },
      },
      {
        FollowupDate: req.query.FollowupDate,
      },
    ];

  } else {

    // Created Date Range
    if (req.query.DateFrom || req.query.DateTo) {
      query.Date = {};
      if (req.query.DateFrom) {
        query.Date.$gte = req.query.DateFrom;
      }
      if (req.query.DateTo) {
        query.Date.$lte = req.query.DateTo;
      }
    }
    // Followup Date
    if (req.query.FollowupDate) {
      query.FollowupDate = req.query.FollowupDate;
    }
  }
  if (req.query.LeadStatus)
    query.LeadStatus = req.query.LeadStatus;
  if (req.query.Assignee)
    query.Assignee = req.query.Assignee;
  if (req.query.TeamCode)
    query.TeamCode = req.query.TeamCode;

  if (req.query.LeadSource)
    query.LeadSource = req.query.LeadSource;

  if (req.query.Reason)
    query.Reason = req.query.Reason;

  if (req.query.FieldMember)
    query.FieldMember = req.query.FieldMember;

  if (req.query.Gender)
    query.Gender = req.query.Gender;

  const totalRecords =
    await Lead.countDocuments(query);

  const leads =
    await Lead.find(query)
      .sort({ LeadNo: -1 }).skip(skip).limit(limit);

  res.status(200).json({
    success: true,
    page,
    limit,
    totalRecords,
    totalPages:
      Math.ceil(totalRecords / limit),
    hasNextPage:
      page < Math.ceil(totalRecords / limit),
    hasPrevPage:
      page > 1,
    count: leads.length,
    data: leads
  });
});

// ================= GET BY ID =================
const getLeadById = asyncHandler(async (req, res) => {
  const lead =
    await Lead.findById(req.params.id);

  if (!lead) {
    throw new ApiError(
      404,
      "Lead not found"
    );
  }

  res.status(200).json({
    success: true,
    data: lead
  });
});

// ================= LEAD NAVIGATION =================
const getLeadNavigation = asyncHandler(async (req, res) => {
  const currentLead = await Lead.findById(req.params.id);

  if (!currentLead) {
    throw new ApiError(404, "Lead not found");
  }

  const query = {};

  if (req.query.search) {
    const search = req.query.search;

    query.$or = [
      { ClientName: { $regex: search, $options: "i" } },
      { CallingNo: { $regex: search, $options: "i" } },
      { WhatsAppNo: { $regex: search, $options: "i" } },
      { LeadSource: { $regex: search, $options: "i" } },
    ];

    if (!isNaN(search)) {
      query.$or.push({
        LeadNo: Number(search),
      });
    }
  }

  // Created Date Range
  if (req.query.DateFrom || req.query.DateTo) {
    query.Date = {};
    if (req.query.DateFrom) {
      query.Date.$gte = req.query.DateFrom;
    }
    if (req.query.DateTo) {
      query.Date.$lte = req.query.DateTo;
    }
  }
  // Followup Date (Single Date)
  if (req.query.FollowupDate) {
    query.FollowupDate = req.query.FollowupDate;
  }
  if (req.query.LeadStatus)
    query.LeadStatus = req.query.LeadStatus;

  if (req.query.Assignee)
    query.Assignee = req.query.Assignee;

  if (req.query.TeamCode)
    query.TeamCode = req.query.TeamCode;

  if (req.query.LeadSource)
    query.LeadSource = req.query.LeadSource;

  if (req.query.Reason)
    query.Reason = req.query.Reason;

  if (req.query.FieldMember)
    query.FieldMember = req.query.FieldMember;

  if (req.query.Gender)
    query.Gender = req.query.Gender;


  const leads = await Lead.find(query)
    .sort({ LeadNo: -1 })
    .select("_id");

  const currentIndex = leads.findIndex(
    (lead) => lead._id.toString() === req.params.id
  );

  const previousId =
    currentIndex > 0 ? leads[currentIndex - 1]._id : null;

  const nextId =
    currentIndex < leads.length - 1
      ? leads[currentIndex + 1]._id
      : null;

  res.status(200).json({
    success: true,
    previousId,
    nextId,
  });
});

// ================= UPDATE LEAD =================
const updateLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  const changes = [];

  const fields = [
    { key: "LeadStatus", label: "Lead Status" },
    { key: "Assignee", label: "Assignee" },
    { key: "FieldMember", label: "Field Member" },
    { key: "Location", label: "Location" },
    { key: "BookingStatus", label: "Booking Status" },
    { key: "Visited", label: "Visited" },
    { key: "Reason", label: "Reason" },
    { key: "Feedback", label: "Feedback" }
  ];

  fields.forEach(({ key, label }) => {
    const oldValue = lead[key] || "";
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

  const user = req.body.UpdatedBy || "System";

  let workLogs = lead.workLogs || [];

  // Field changes worklog
  const messages = [];

  // Manual Comment
  if (req.body.Comments && req.body.Comments.trim()) {
    messages.push(req.body.Comments.trim());
  }

  // Field Changes
  if (changes.length > 0) {
    messages.push(...changes);
  }

  // Single WorkLog Entry
  if (messages.length > 0) {
    workLogs.push({
      message: messages.join("\n"),
      createdBy: user,
      createdAt: new Date(),
    });
  }
  const { Comments, ...updateData } = req.body;
  const updatedLead = await Lead.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
      workLogs,
      UpdatedBy: user
    },
    {
      returnDocument: "after",
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    message: "Lead updated successfully",
    data: updatedLead
  });
});

// ================= DELETE LEAD =================
const deleteLead =
  asyncHandler(async (req, res) => {
    const lead =
      await Lead.findByIdAndUpdate(
        req.params.id,
        {
          IsActive: false
        },
        {
          returnDocument: "after"
        }
      );
    if (!lead) {
      throw new ApiError(
        404,
        "Lead not found"
      );
    }
    res.status(200).json({
      success: true,
      message: "Lead deleted successfully"
    });
  });

// ================= ADD WORK LOG =================
const addWorkLog =
  asyncHandler(async (req, res) => {
    const lead =
      await Lead.findById(req.params.id);
    if (!lead) {
      throw new ApiError(
        404,
        "Lead not found"
      );
    }
    const log =
      `\n\n${convertStringFormatDateTime(new Date())}
- ${req.body.createdBy}
${req.body.message}`;
    lead.WorkLogs =
      (lead.WorkLogs || "") + log;
    await lead.save();
    res.status(200).json({
      success: true,
      message: "WorkLog added successfully",
      data: lead
    });
  });

// ================= DROPDOWN =================
const getLeadDropdown =
  asyncHandler(async (req, res) => {
    const [
      leadStatus,
      leadSource,
      locations,
      teams,
      assignees,
    ] = await Promise.all([
      Lead.distinct("LeadStatus"),
      Lead.distinct("LeadSource"),
      Lead.distinct("Location"),
      Lead.distinct("TeamCode"),
      Lead.distinct("Assignee"),

    ]);
    res.status(200).json({
      success: true,
      LeadStatus: leadStatus,
      LeadSource: leadSource,
      Location: locations,
      TeamCode: teams,
      Assignee: assignees,
    });
  });

module.exports = {
  createLead,
  bulkCreateLead,
  getAllLeads,
  getLeadById,
  getLeadNavigation,
  updateLead,
  deleteLead,
  addWorkLog,
  getLeadDropdown
};