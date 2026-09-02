const Ticket = require("../models/ticket.model");
const asyncHandler = require("../middleware/asyncHandler");
const uploadFile = require("../services/uploadFile");
const ApiError = require("../utils/ApiError");
const Client = require("../models/client.model");
const { convertStringFormatDateTime, convertStringToDateTime } = require("../utils/dateFormatter");

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
        customerImpacted: "Yes",
        attachment: attachments,
        dateCreated: convertStringFormatDateTime(new Date())
    });

    res.status(201).json({
        success: true,
        message: "Ticket created successfully",
        data: ticket,
    });
});

const getAllClientTickets = asyncHandler(async (req, res) => {
    const clientId = req.query.clientId;

    if (!clientId) {
        throw new ApiError(400, "clientId is required");
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const query = {
        createdById: clientId,
    };
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





    // ================= Count =================

    const totalRecords = await Ticket.countDocuments(query);

    // ================= DB Pagination + Sorting =================

    const tickets = await Ticket.find(query)
        .populate({
            path: "propertyId",
            select: "_id propertyCode",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
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

const getClientDetailsById = async (req, res) => {
    try {
        const { clientId } = req.params;

        const client = await Client.findById(clientId)
            .select("propertyId bedId")
            .populate("propertyId", "_id propertyCode")
            .populate("bedId", "_id roomNo bedNo");

        if (!client) {
            return res.status(404).json({
                success: false,
                message: "Client not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                propertyId: client.propertyId || null,
                bedId: client.bedId || null,
            },
        });
    } catch (error) {
        console.error("Get Client Details Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
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

const getTicketNavigation = asyncHandler(async (req, res) => {
    const currentTicket = await Ticket.findById(req.params.id);

    if (!currentTicket) {
        throw new ApiError(404, "Ticket not found");
    }

    // Same query as getAllTickets
    const query = {};

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

    // Same order as Ticket List
    const tickets = await Ticket.find(query)
        .sort({ createdAt: -1 })
        .select("_id");

    const currentIndex = tickets.findIndex(
        (t) => t._id.toString() === req.params.id
    );

    const previousId =
        currentIndex > 0
            ? tickets[currentIndex - 1]._id
            : null;

    const nextId =
        currentIndex < tickets.length - 1
            ? tickets[currentIndex + 1]._id
            : null;

    res.status(200).json({
        success: true,
        previousId,
        nextId,
    });
});

const updateTicket = asyncHandler(async (req, res) => {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
        throw new ApiError(404, "Ticket not found");
    }

    const newStatus = req.body.status;


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
            workLogs,
            updatedDateTime: convertStringFormatDateTime(
                new Date()
            ),
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

module.exports = {
    createTicket,
    getTicketById,
    updateTicket,
    deleteTicket,
    // addWorkLog,
    // getTicketDropdown,
    getTicketNavigation,
    getClientDetailsById,
    getAllClientTickets,
};