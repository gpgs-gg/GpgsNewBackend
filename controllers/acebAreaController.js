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
    // const propertyExists = await Property.findById(propertyId);

    // if (!propertyExists) {
    //     throw new ApiError(404, "Selected property not found");
    // }

    const existingProperty = await Property.findOne({
        propertyId,
    });

    if (existingProperty) {
        throw new ApiError(409, "Property already exists");
    }
const areas = [];
    // Create areas according to type + count
    areaTypes.forEach((areaType) => {
        const type = areaType.type;
        const isActive = areaType.isActive !== undefined ? areaType.isActive : true;

        if (!["ROOM", "HALL", "KITCHEN"].includes(type)) {
            throw new ApiError(400, "Invalid area type");
        }

        if (type === "ROOM") {
            const count = Number(areaType.count);

            if (!count || count < 1 || count > 100) {
                throw new ApiError(400, "Room count must be between 1 and 100");
            }

            for (let i = 1; i <= count; i++) {
                areas.push({
                    name: `RoomNo_${i}_ACEB`,
                    type: "ROOM",
                    isActive,
                });
            }
        } else if (type === "HALL") {
            areas.push({
                name: "RoomNo_Hall_ACEB",
                type: "HALL",
                isActive,
            });
        } else if (type === "KITCHEN") {
            areas.push({
                name: "RoomNo_Kitchen_ACEB",
                type: "KITCHEN",
                isActive,
            });
        }
    });
    const property = await Property.create({
        propertyId,
        location,
        areas,
    });

    res.status(201).json({
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
const {
        propertyId,
        location,
        areas = [],
        areaTypes = [],
    } = req.body;

    const property = await Property.findById(
        req.params.id
    );

    if (!property) {
        throw new ApiError(
            404,
            "Property not found"
        );
    }

    // ================= Property Code =================

    if (propertyId !== undefined) {
   if (!propertyId) {
            throw new ApiError(400, "Please select a property.");
        }

       const duplicate = await Property.findOne({
            propertyId,
            _id: { $ne: req.params.id },
        });

        if (duplicate) {
            throw new ApiError(
                409,
               "This property already has areas created."
            );
        }
property.propertyId = propertyId;
     
    }

   

    // ================= Location =================

    if (location !== undefined) {
        property.location = location;
    }

    // ================= Areas =================

  // ================= Validation =================

    if (!Array.isArray(areas)) {
        throw new ApiError(
            400,
            "Invalid area data. Please provide valid areas."
        );
    }

    if (!Array.isArray(areaTypes)) {
        throw new ApiError(
            400,
            "Invalid area type data."
        );
    }

    // ================= Final Areas =================

    const finalAreas = [];

    // ================= Existing Areas =================

    for (const area of areas) {
        if (!area.type) {
            throw new ApiError(
                400,
                "Please select a valid area type."
            );
        }

        if (!["ROOM", "HALL", "KITCHEN"].includes(area.type)) {
            throw new ApiError(
                400,
                "Please select a valid area type."
            );
        }

        if (!area.name || !area.name.trim()) {
            throw new ApiError(
                400,
                "Please enter an area name."
            );
        }

        const name = area.name.trim();

        const duplicate = finalAreas.some(
            (existingArea) =>
                existingArea.name === name &&
                existingArea.type === area.type
        );

        if (duplicate) {
            throw new ApiError(
                409,
                `Area "${name}" already exists.`
            );
        }

        // ================= Existing Area =================

        if (area.areaId) {
            const oldArea = property.areas.find(
                (old) =>
                    String(old.areaId) === String(area.areaId)
            );

            if (!oldArea) {
                throw new ApiError(
                    404,
                    `Area "${name}" not found.`
                );
            }

            finalAreas.push({
                areaId: oldArea.areaId,
                name,
                type: area.type,
                isActive:
                    area.isActive !== undefined
                        ? area.isActive
                        : oldArea.isActive,
            });
        }

        // ================= New Manual Area =================

        else {
            finalAreas.push({
                name,
                type: area.type,
                isActive:
                    area.isActive !== undefined
                        ? area.isActive
                        : true,
            });
        }
    }

    // ================= New Area Types =================

    for (const areaType of areaTypes) {
        const type = areaType.type;

        const isActive =
            areaType.isActive !== undefined
                ? areaType.isActive
                : true;

        if (!["ROOM", "HALL", "KITCHEN"].includes(type)) {
            throw new ApiError(
                400,
                "Please select a valid area type."
            );
        }

        // ================= ROOM =================

        if (type === "ROOM") {
            const count = Number(areaType.count);

            if (
                !Number.isInteger(count) ||
                count < 1 ||
                count > 100
            ) {
                throw new ApiError(
                    400,
                    "Please select the number of rooms between 1 and 100."
                );
            }

            // Find highest existing Room number
            let maxRoomNumber = 0;

            finalAreas.forEach((area) => {
                if (area.type !== "ROOM") return;

                const match = area.name.match(
                    /^RoomNo_(\d+)_ACEB$/
                );

                if (match) {
                    const roomNumber = Number(match[1]);

                    if (roomNumber > maxRoomNumber) {
                        maxRoomNumber = roomNumber;
                    }
                }
            });

            // Create next rooms
            for (let i = 1; i <= count; i++) {
                const roomNumber = maxRoomNumber + i;
                const name = `RoomNo_${roomNumber}_ACEB`;

                const alreadyExists = finalAreas.some(
                    (area) =>
                        area.name === name &&
                        area.type === "ROOM"
                );

                if (alreadyExists) {
                    continue;
                }

                finalAreas.push({
                    name,
                    type: "ROOM",
                    isActive,
                });
            }
        }

        // ================= HALL =================

        else if (type === "HALL") {
            const name = "RoomNo_Hall_ACEB";

            const alreadyExists = finalAreas.some(
                (area) =>
                    area.name === name &&
                    area.type === "HALL"
            );

            if (alreadyExists) {
                continue;
            }

            finalAreas.push({
                name,
                type: "HALL",
                isActive,
            });
        }

        // ================= KITCHEN =================

        else if (type === "KITCHEN") {
            const name = "RoomNo_Kitchen_ACEB";

            const alreadyExists = finalAreas.some(
                (area) =>
                    area.name === name &&
                    area.type === "KITCHEN"
            );

            if (alreadyExists) {
                continue;
            }

            finalAreas.push({
                name,
                type: "KITCHEN",
                isActive,
            });
        }
    }

    // ================= Save =================

    property.areas = finalAreas;

    await property.save();

    res.status(200).json({
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