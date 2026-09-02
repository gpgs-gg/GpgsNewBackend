const Property = require("../models/acebArea.model");
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");

// ================= Create Property =================

const createProperty = asyncHandler(async (req, res) => {
    const { propertyId, location, areas = [] } = req.body;

    if (!propertyId) {
        throw new ApiError(400, "Property is required");
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
        propertyCode,
        propertyName,
        location,
        areas,
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

    if (propertyCode !== undefined) {
        const trimmedCode =
            propertyCode.trim();

        const duplicate =
            await Property.findOne({
                propertyCode: trimmedCode,
                _id: {
                    $ne: req.params.id,
                },
            });

        if (duplicate) {
            throw new ApiError(
                409,
                "Property Code already exists"
            );
        }

        property.propertyCode =
            trimmedCode;
    }

    // ================= Property Name =================

    if (propertyName !== undefined) {
        property.propertyName =
            propertyName.trim();
    }

    // ================= Location =================

    if (location !== undefined) {
        property.location = location;
    }

    // ================= Areas =================

    if (areas !== undefined) {

        const oldAreas = property.areas || [];

        property.areas = areas.map((area) => {

            // =========================================
            // 1. If frontend already sends areaId
            //    Keep that ID
            // =========================================

            if (area.areaId) {
                return {
                    areaId: area.areaId,
                    name: area.name,
                    type: area.type,
                    isActive:
                        area.isActive !== undefined
                            ? area.isActive
                            : true,
                };
            }

            // =========================================
            // 2. If areaId is missing
            //    Find old area by name
            // =========================================

            const oldArea = oldAreas.find(
                (old) =>
                    old.name === area.name &&
                    old.type === area.type
            );

            if (oldArea) {
                return {
                    areaId: oldArea.areaId,
                    name: area.name,
                    type: area.type,
                    isActive:
                        area.isActive !== undefined
                            ? area.isActive
                            : oldArea.isActive,
                };
            }

            // =========================================
            // 3. Completely NEW area
            //    Don't send areaId
            //    Schema default generates it
            // =========================================

            return {
                name: area.name,
                type: area.type,
                isActive:
                    area.isActive !== undefined
                        ? area.isActive
                        : true,
            };
        });
    }

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