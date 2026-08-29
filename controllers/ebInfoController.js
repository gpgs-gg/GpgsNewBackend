const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");
const uploadFile = require("../services/uploadFile");
const Property = require("../models/property.model");
const EBMonthly = require("../models/ebInfo.model");
const { convertStringFormatDateTime } = require("../utils/dateFormatter");


const creaetElectricityBillData = asyncHandler(async (req, res) => {
    const {
        propertyCode,
        billingMonth,
        flatUnits,
        flatEB,
        assignee,
        status,
        reviewer,
        ebPaidStatus,
        EBCycle,
    } = req.body;

    if (!propertyCode) {
        throw new ApiError(400, "PropertyCode is required");
    }

    if (!billingMonth) {
        throw new ApiError(400, "BillingMonth is required");
    }

    // ================= PROPERTY CHECK =================

    const property = await Property.findOne({
        propertyCode,
    });

    if (!property) {
        throw new ApiError(404, "Property not found");
    }

    // ================= CHECK EXISTING =================

    let monthlyData = await EBMonthly.findOne({
        propertyCode,
        billingMonth,
        EBCycle
    });

    // ================= FILE UPLOAD =================

    let uploadedFiles = [];

    if (req.files?.length > 0) {
        uploadedFiles = await Promise.all(
            req.files.map((file) =>
                uploadFile(
                    file,
                    `EB/${billingMonth}/${propertyCode}`
                )
            )
        );
    }

    // ================= CREATE =================

    if (!monthlyData) {
        monthlyData = new EBMonthly({
            propertyCode,
            billingMonth,
            EBCycle,
            flatUnits:
                flatUnits !== undefined ? flatUnits : null,
            flatEB:
                flatEB !== undefined ? flatEB : null,
            assignee:
                assignee !== undefined ? assignee : "",
            status:
                status !== undefined && status !== ""
                    ? status
                    : "Open",
            reviewer:
                reviewer !== undefined ? reviewer : "",
            ebPaidStatus:
                ebPaidStatus !== undefined ? ebPaidStatus : "",
            attachment:
                uploadedFiles.join(","),
        });

        await monthlyData.save();

        return res.status(201).json({
            success: true,
            message: "EB data created successfully",
            data: monthlyData,
        });
    }

    // ================= EXISTING RECORD =================

    monthlyData.flatUnits =
        flatUnits !== undefined
            ? flatUnits
            : monthlyData.flatUnits;

    monthlyData.flatEB =
        flatEB !== undefined
            ? flatEB
            : monthlyData.flatEB;

    monthlyData.assignee =
        assignee !== undefined
            ? assignee
            : monthlyData.assignee;

    monthlyData.reviewer =
        reviewer !== undefined
            ? assignee
            : monthlyData.reviewer;

    monthlyData.ebPaidStatus =
        ebPaidStatus !== undefined
            ? ebPaidStatus
            : monthlyData.ebPaidStatus;

    monthlyData.status =
        status !== undefined
            ? status
            : monthlyData.status;

    // ================= ATTACHMENTS =================

    let attachments = monthlyData.attachment
        ? monthlyData.attachment
            .split(",")
            .filter(Boolean)
        : [];

    if (uploadedFiles.length > 0) {
        attachments = [
            ...attachments,
            ...uploadedFiles,
        ];
    }

    monthlyData.attachment =
        attachments.join(",");

    await monthlyData.save();

    res.status(200).json({
        success: true,
        message: "EB data updated successfully",
        data: monthlyData,
    });
});

const getElectricityBillData = asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const requestedLimit = Number(req.query.limit) || 10;
    const limit = Math.min(Math.max(requestedLimit, 1), 10);
    const skip = (page - 1) * limit;

    const {
        billingMonth,
        search,
        propertyCode,
        status,
        ebPaidStatus,
        EBCycle,
        assignee,
        reviewer,
    } = req.query;

    const propertyQuery = {};

    if (search?.trim()) {
        propertyQuery.propertyCode = {
            $regex: search.trim(),
            $options: "i",
        };
    }

    if (propertyCode?.trim()) {
        propertyQuery.propertyCode = propertyCode.trim();
    }

    if (EBCycle?.trim()) {
        propertyQuery["utility.ebStartCycle"] = EBCycle.trim();
    }

    const properties = await Property.find(propertyQuery)
        .sort({ createdAt: -1 })
        .lean();

    if (!properties.length) {
        return res.status(200).json({
            success: true,
            billingMonth,
            page,
            limit,
            totalRecords: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: page > 1,
            count: 0,
            data: [],
        });
    }

    const propertyCodes = properties
        .map((property) => property.propertyCode)
        .filter(Boolean);

    const monthlyQuery = {
        billingMonth,
        propertyCode: { $in: propertyCodes },
    };

    if (status?.trim()) {
        monthlyQuery.status = status.trim();
    }

    if (ebPaidStatus?.trim()) {
        monthlyQuery.ebPaidStatus = ebPaidStatus.trim();
    }

    if (assignee?.trim()) {
        monthlyQuery.assignee = assignee.trim();
    }

    if (reviewer?.trim()) {
        monthlyQuery.reviewer = reviewer.trim();
    }

    const monthlyData = await EBMonthly.find(monthlyQuery).lean();

    const monthlyMap = new Map(
        monthlyData.map((item) => [item.propertyCode, item])
    );

    let filteredProperties = properties;

    const hasMonthlyFilters =
        status || ebPaidStatus || assignee || reviewer;

    if (hasMonthlyFilters) {
        filteredProperties = properties.filter((property) =>
            monthlyMap.has(property.propertyCode)
        );
    }

    const totalRecords = filteredProperties.length;

    const paginatedProperties = filteredProperties.slice(
        skip,
        skip + limit
    );

    const data = paginatedProperties.map((property) => {
        const monthly = monthlyMap.get(property.propertyCode);

    const EBCycle = property.utility?.ebStartCycle ?? "";

    const EBCalnDate =
        EBCycle !== "" && !isNaN(Number(EBCycle))
            ? Number(EBCycle) + 5
            : "";

        return {
            propertyCode: property.propertyCode,
            EBCycle,
            SubMeterDetails: property.subMeterDetails ?? "",
            EBCalnDate,
            flatUnits: monthly?.flatUnits ?? null,
            flatEB: monthly?.flatEB ?? null,
            assignee: monthly?.assignee ?? "",
            reviewer: monthly?.reviewer ?? "",
            status: monthly?.status ?? "",
            ebPaidStatus: monthly?.ebPaidStatus ?? "",
            attachment: monthly?.attachment ?? "",
            workLogs: monthly?.workLogs ?? "",
            billingMonth,
            monthlyRecordExists: Boolean(monthly),
            monthlyRecordId: monthly?._id ?? null,
        };
    });

    const totalPages = Math.ceil(totalRecords / limit);

    return res.status(200).json({
        success: true,
        billingMonth,
        page,
        limit,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        count: data.length,
        data,
    });
});

const getSingleElectricityBillData = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const data = await EBMonthly.findById(id);

    if (!data) {
        throw new ApiError(404, "EB record not found");
    }

    res.status(200).json({
        success: true,
        data,
    });
});

const updateElectricityBillData = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const monthlyData = await EBMonthly.findById(id);

    if (!monthlyData) {
        throw new ApiError(404, "EB record not found");
    }

    const user =
        req.body.updatedByName ||
        req.body.createdByName ||
        "System";

    let workLogs = monthlyData.workLogs || [];
    const changes = [];

    // File Upload
    let uploadedFiles = [];

    if (req.files?.length > 0) {
        uploadedFiles = await Promise.all(
            req.files.map((file) =>
                uploadFile(
                    file,
                    `EB/${monthlyData.billingMonth}/${monthlyData.propertyCode}`
                )
            )
        );
    }

    // Attachments
    let attachments = monthlyData.attachment
        ? monthlyData.attachment.split(",").filter(Boolean)
        : [];

    if (uploadedFiles.length > 0) {
        attachments = [...attachments, ...uploadedFiles];
    }

    // Field Changes
    const fields = [
        { key: "flatUnits", label: "Flat Units" },
        { key: "flatEB", label: "Flat EB" },
        { key: "assignee", label: "Assignee" },
        { key: "reviewer", label: "Reviewer" },
        { key: "status", label: "Status" },
        { key: "ebPaidStatus", label: "EB Paid Status" },
    ];

    fields.forEach(({ key, label }) => {
        const oldValue = monthlyData[key] ?? "";
        const newValue = req.body[key];

        if (
            newValue !== undefined &&
            String(oldValue) !== String(newValue)
        ) {
            changes.push(
                `${label} changed from "${oldValue || "Blank"}" to "${newValue || "Blank"}"`
            );
        }
    });

    // Attachment WorkLog
    if (req.files?.length > 0) {
        const fileNames = req.files
            .map((file) => file.originalname)
            .join(", ");

        changes.push(
            `Uploaded ${req.files.length} attachment(s): ${fileNames}`
        );
    }

    // Manual WorkLog
    const newWorkLog = String(
        req.body.newWorkLog || ""
    ).trim();

    if (newWorkLog) {
        workLogs.push({
            message: newWorkLog,
            createdBy: user,
            createdAt: convertStringFormatDateTime(new Date()),
        });
    }

    // Automatic WorkLog
    if (changes.length > 0) {
        workLogs.push({
            message: changes.join("\n"),
            createdBy: user,
            createdAt: convertStringFormatDateTime(new Date()),
        });
    }

    // Update
    monthlyData.flatUnits =
        req.body.flatUnits !== undefined
            ? req.body.flatUnits
            : monthlyData.flatUnits;

    monthlyData.flatEB =
        req.body.flatEB !== undefined
            ? req.body.flatEB
            : monthlyData.flatEB;

    monthlyData.assignee =
        req.body.assignee !== undefined
            ? req.body.assignee
            : monthlyData.assignee;

    monthlyData.reviewer =
        req.body.reviewer !== undefined
            ? req.body.reviewer
            : monthlyData.reviewer;

    monthlyData.status =
        req.body.status !== undefined
            ? req.body.status
            : monthlyData.status;

    monthlyData.ebPaidStatus =
        req.body.ebPaidStatus !== undefined
            ? req.body.ebPaidStatus
            : monthlyData.ebPaidStatus;

    monthlyData.attachment = attachments.join(",");
    monthlyData.workLogs = workLogs;
    monthlyData.updatedDateTime =
        convertStringFormatDateTime(new Date());

    await monthlyData.save();

    res.status(200).json({
        success: true,
        message: "EB data updated successfully",
        data: monthlyData,
    });
});

module.exports = {
    getElectricityBillData,
    updateElectricityBillData,
    creaetElectricityBillData,
    getSingleElectricityBillData
};