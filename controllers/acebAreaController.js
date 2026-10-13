const Property = require("../models/acebArea.model");
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");

// ================= Create Property =================

const createProperty = asyncHandler(async (req, res) => {
    const { propertyId, location, areaTypes = [] } = req.body;

    if (!propertyId) {
        throw new ApiError(400, "Property is required");
    }

    if (!Array.isArray(areaTypes) || areaTypes.length === 0) {
        throw new ApiError(400, "At least one area type is required");
    }

    const existingProperty = await Property.findOne({ propertyId });

    if (existingProperty) {
        throw new ApiError(409, "Property already exists");
    }

    let totalRoomCount = 0;
    let roomIsActive = true;

    let hall = null;
    let kitchen = null;

    // Validate and combine area types
    areaTypes.forEach((areaType) => {
        const { type } = areaType;

        const isActive =
            areaType.isActive !== undefined
                ? areaType.isActive
                : true;

        if (!["ROOM", "HALL", "KITCHEN"].includes(type)) {
            throw new ApiError(400, "Invalid area type");
        }

        if (type === "ROOM") {
            const count = Number(areaType.count);

            if (
                !Number.isInteger(count) ||
                count < 1 ||
                count > 100
            ) {
                throw new ApiError(
                    400,
                    "Room count must be between 1 and 100"
                );
            }

            totalRoomCount = count;
            roomIsActive = isActive;

            if (totalRoomCount > 100) {
                throw new ApiError(
                    400,
                    "Total room count cannot exceed 100"
                );
            }
        }

        if (type === "HALL") {
            if (hall !== null) {
                throw new ApiError(
                    400,
                    "Duplicate HALL area is not allowed"
                );
            }

            hall = { isActive };
        }

        if (type === "KITCHEN") {
            if (kitchen !== null) {
                throw new ApiError(
                    400,
                    "Duplicate KITCHEN area is not allowed"
                );
            }

            kitchen = { isActive };
        }
    });

    const areas = [];

// Create only the selected room number
const roomAreaTypes = areaTypes.filter(
    (areaType) => areaType.type === "ROOM"
);

for (const areaType of roomAreaTypes) {
    const roomNo = Number(areaType.count);

    if (
        !Number.isInteger(roomNo) ||
        roomNo < 1 ||
        roomNo > 100
    ) {
        throw new ApiError(
            400,
            "Room number must be between 1 and 100"
        );
    }

    areas.push({
        name: `RoomNo_${roomNo}_ACEB`,
        type: "ROOM",
        isActive:
            areaType.isActive !== undefined
                ? areaType.isActive
                : true,
    });
}
    // Create one hall if requested
    if (hall) {
        areas.push({
            name: "RoomNo_Hall_ACEB",
            type: "HALL",
            isActive: hall.isActive,
        });
    }

    // Create one kitchen if requested
    if (kitchen) {
        areas.push({
            name: "RoomNo_Kitchen_ACEB",
            type: "KITCHEN",
            isActive: kitchen.isActive,
        });
    }

    const property = await Property.create({
        propertyId,
        location,
        areas,
    });

    return res.status(201).json({
        success: true,
        message: "Property created successfully",
        data: property,
    });
});
// ================= Get All Properties =================

const getProperties = asyncHandler(async (req, res) => {
    // Pagination
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;
    // Build filter query
    const query = {};
    // Search
    if (req.query.search) {
        query.$or = [
            {
                propertyCode: {
                    $regex: req.query.search,
                    $options: "i",
                },
            },
            {
                propertyName: {
                    $regex: req.query.search,
                    $options: "i",
                },
            },
            {
                propertyLocation: {
                    $regex: req.query.search,
                    $options: "i",
                },
            },
        ];
    }

    // Filters

    // Count filtered records
    const totalRecords = await Property.countDocuments(query);

    // Fetch filtered + paginated data
    const properties = await Property.find(query)
        .populate({
            path: "propertyId",
            select: "propertyCode propertyLocation",
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
        count: properties.length,
        data: properties,
    });
});
// ================= Get Single Property =================

const getPropertyById = asyncHandler(async (req, res) => {
    const property = await Property.findById(req.params.id)
        .populate({
            path: "propertyId",
            select: "propertyCode propertyLocation",
        })
        .lean();

    if (!property) {
        throw new ApiError(404, "Property not found");
    }

    res.status(200).json({
        success: true,
        data: property,
    });
});
// ================= Update Property =================

// const updateProperty = asyncHandler(async (req, res) => {
//     const { propertyCode, propertyName, location, areas } = req.body;

//     const property = await Property.findById(req.params.id);

//     if (!property) {
//         throw new ApiError(404, "Property not found");
//     }

//     if (propertyCode) {
//         const duplicate = await Property.findOne({
//             propertyCode: propertyCode.trim(),
//             _id: { $ne: req.params.id },
//         });

//         if (duplicate) {
//             throw new ApiError(409, "Property Code already exists");
//         }

//         property.propertyCode = propertyCode.trim();
//     }

//     if (propertyName !== undefined) {
//         property.propertyName = propertyName.trim();
//     }

//     if (location !== undefined) {
//         property.location = location;
//     }

//     if (areas !== undefined) {
//         property.areas = areas;
//     }

//     await property.save();

//     res.status(200).json({
//         success: true,
//         message: "Property updated successfully",
//         data: property,
//     });
// });



const updateProperty = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        propertyId,
        location,
        areas = [],
        areaTypes = [],
    } = req.body;

    // ================= Find Property =================
    const property = await Property.findById(id);

    if (!property) {
        throw new ApiError(404, "Property not found");
    }

    // ================= Validate Property ID =================
    if (propertyId) {
        const existingProperty = await Property.findOne({
            propertyId,
            _id: { $ne: id },
        });

        if (existingProperty) {
            throw new ApiError(409, "Property already exists");
        }

        property.propertyId = propertyId;
    }

    // ================= Update Location =================
    if (location !== undefined) {
        property.location = location;
    }

    // ================= Validate Arrays =================
    if (!Array.isArray(areas)) {
        throw new ApiError(400, "Areas must be an array");
    }

    if (!Array.isArray(areaTypes)) {
        throw new ApiError(400, "Area types must be an array");
    }

    // ================= Prepare Existing / Manual Areas =================
    const finalAreas = [];
    const areaNames = new Set();

    for (const area of areas) {
        const { areaId, name, type, isActive } = area;

        if (!["ROOM", "HALL", "KITCHEN"].includes(type)) {
            throw new ApiError(400, "Invalid area type");
        }

        if (!name || !name.trim()) {
            throw new ApiError(400, "Area name is required");
        }

        const normalizedName = name.trim();
        const uniqueKey = `${type}_${normalizedName}`;

        if (areaNames.has(uniqueKey)) {
            throw new ApiError(
                400,
                `Duplicate area is not allowed: ${normalizedName}`
            );
        }

        areaNames.add(uniqueKey);

        // Preserve the original area's isActive value when areaId exists
        const existingArea = areaId
            ? property.areas.find(
                (item) =>
                    item._id &&
                    areaId &&
                    item._id.toString() === areaId.toString()
            )
            : null;

        finalAreas.push({
            ...(existingArea ? { _id: existingArea._id } : {}),
            name: normalizedName,
            type,
            isActive:
                isActive !== undefined
                    ? isActive
                    : existingArea
                        ? existingArea.isActive
                        : true,
        });
    }

    // ================= Read Requested Area Types =================
    let requestedRoomCount = null;
    let requestedRoomIsActive = true;
    let requestedHall = null;
    let requestedKitchen = null;

    for (const areaType of areaTypes) {
        const { type } = areaType;

        if (!["ROOM", "HALL", "KITCHEN"].includes(type)) {
            throw new ApiError(400, "Invalid area type");
        }

        const isActive =
            areaType.isActive !== undefined ? areaType.isActive : true;

        if (type === "ROOM") {
            // Ignore empty/null room counts
            if (
                areaType.count === null ||
                areaType.count === undefined ||
                areaType.count === ""
            ) {
                continue;
            }

            const count = Number(areaType.count);

            if (!Number.isInteger(count) || count < 1 || count > 100) {
                throw new ApiError(
                    400,
                    "Room count must be between 1 and 100"
                );
            }

            // Last valid ROOM count becomes the total desired room count
            requestedRoomCount = count;
            requestedRoomIsActive = isActive;
        }

        if (type === "HALL") {
            if (requestedHall !== null) {
                throw new ApiError(
                    400,
                    "Duplicate HALL area is not allowed"
                );
            }

            requestedHall = { isActive };
        }

        if (type === "KITCHEN") {
            if (requestedKitchen !== null) {
                throw new ApiError(
                    400,
                    "Duplicate KITCHEN area is not allowed"
                );
            }

            requestedKitchen = { isActive };
        }
    }

    // ================= Add Rooms Up To Requested Total =================
    if (requestedRoomCount !== null) {
        const existingRooms = finalAreas.filter(
            (area) => area.type === "ROOM"
        );

        const currentRoomCount = existingRooms.length;

        if (requestedRoomCount > currentRoomCount) {
            const existingRoomNumbers = existingRooms.map((area) => {
                const match = area.name.match(/^RoomNo_(\d+)_ACEB$/);
                return match ? Number(match[1]) : 0;
            });

            const existingRoomNames = new Set(
                existingRooms.map((area) => area.name)
            );

            let roomNumber = Math.max(0, ...existingRoomNumbers);

            while (
                finalAreas.filter((area) => area.type === "ROOM").length <
                requestedRoomCount
            ) {
                roomNumber++;

                const roomName = `RoomNo_${roomNumber}_ACEB`;

                if (existingRoomNames.has(roomName)) {
                    continue;
                }

                finalAreas.push({
                    name: roomName,
                    type: "ROOM",
                    isActive: requestedRoomIsActive,
                });

                existingRoomNames.add(roomName);
            }
        }
    }

    // ================= Add HALL If Requested =================
    if (requestedHall !== null) {
        const hallExists = finalAreas.some(
            (area) => area.type === "HALL"
        );

        if (!hallExists) {
            finalAreas.push({
                name: "RoomNo_Hall_ACEB",
                type: "HALL",
                isActive: requestedHall.isActive,
            });
        }
    }

    // ================= Add KITCHEN If Requested =================
    if (requestedKitchen !== null) {
        const kitchenExists = finalAreas.some(
            (area) => area.type === "KITCHEN"
        );

        if (!kitchenExists) {
            finalAreas.push({
                name: "RoomNo_Kitchen_ACEB",
                type: "KITCHEN",
                isActive: requestedKitchen.isActive,
            });
        }
    }

    // ================= Save Property =================
    property.areas = finalAreas;

    await property.save();

    return res.status(200).json({
        success: true,
        message: "Property updated successfully",
        data: property,
    });
});




// ================= Delete Property =================

const deleteProperty = asyncHandler(async (req, res) => {
    const property = await Property.findByIdAndDelete(req.params.id);

    if (!property) {
        throw new ApiError(404, "Property not found");
    }

    res.status(200).json({
        success: true,
        message: "Property deleted successfully",
    });
});

module.exports = {
    createProperty,
    getProperties,
    getPropertyById,
    updateProperty,
    deleteProperty,
};