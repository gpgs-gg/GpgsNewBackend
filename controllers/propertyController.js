const Property = require("../models/property.model");
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");
// CREATE
const safeParse = require("../utils/safeParse");
const uploadFile = require("../services/uploadFile");

// const createProperty = asyncHandler(async (req, res) => {
//   const files = req.files;
//   const getFile = (key) => files?.[key]?.[0] || null;
//   const propertyCode = req.body.propertyCode;
//   const owner = safeParse(req.body.owner);
//   const internet = safeParse(req.body.internet);
//   const utility = safeParse(req.body.utility);
//   const agreement = safeParse(req.body.agreement);
//   // FILE UPLOADS
//   owner.photo = await uploadFile(
//     getFile("owner[photo]"),
//     `properties/${propertyCode}`
//   );
//   owner.aadharCard = await uploadFile(
//     getFile("owner[aadharCard]"),
//     `properties/${propertyCode}`
//   );
//   // CREATE PROPERTY
//   const property = await Property.create({
//     ...req.body,
//     owner,
//     internet,
//     utility,
//     agreement,
//   });
//   res.status(201).json({
//     success: true,
//     message: "Property created successfully",
//     data: property,
//   });
// });

// READ ALL



const isPdfFile = (file) => {
  return (
    file.mimetype === "application/pdf" ||
    file.originalname?.toLowerCase().endsWith(".pdf")
  );
};

const createProperty = asyncHandler(async (req, res) => {
  const propertyCode = req.body.propertyCode;
  // Check duplicate property
  const existingProperty = await Property.findOne({ propertyCode });
  if (existingProperty) {
    return res.status(400).json({
      success: false,
      message: `Property with code ${propertyCode} already exists`,
    });
  }

  const owner = safeParse(req.body.owner);
  const internet = safeParse(req.body.internet);
  const utility = safeParse(req.body.utility);
  const agreement = safeParse(req.body.agreement);

  const getFiles = (key) => req.files?.[key] || [];
  getFiles("owner[aadharCard]").forEach((file) => {
  });

  const aadharUploads = await Promise.all(
    getFiles("owner[aadharCard]").map((file) =>
      uploadFile(file, `properties/${propertyCode}`)
    )
  );

  const photoUploads = await Promise.all(
    getFiles("owner[photo]").map((file) =>
      uploadFile(file, `properties/${propertyCode}`)
    )
  );

  // assign
  owner.photo = photoUploads;
  owner.aadharCard = aadharUploads;

  const property = await Property.create({
    ...req.body,
    owner,
    internet,
    utility,
    agreement,
  });

  res.status(201).json({
    success: true,
    message: "Property created successfully",
    data: property,
  });
});

const getAllProperties = asyncHandler(async (req, res) => {
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
        propertyLocation: {
          $regex: req.query.search,
          $options: "i",
        },
      },
    ];
  }
  // Filters
  if (req.query.propertyId) {
    query._id = req.query.propertyId;
  }
  if (req.query.propertyLocation) {
    query.propertyLocation = req.query.propertyLocation;
  }
  if (req.query.bedCount) {
    query.bedCount = Number(req.query.bedCount);
  }
  if (req.query.status) {
    query.status = req.query.status;
  }
  // Count only filtered records
  const totalRecords = await Property.countDocuments(query);

  // Fetch filtered + paginated data
  const properties = await Property.find(query)
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
    count: properties.length,
    data: properties,
  });
});

// READ SINGLE
const getPropertyById = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  res.status(200).json({
    success: true,
    data: property,
  });
});

// UPDATE
const updateProperty = asyncHandler(async (req, res) => {
  const files = req.files;

  const property = await Property.findById(req.params.id);

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  const propertyCode = req.body.propertyCode || property.propertyCode;

  const owner = safeParse(req.body.owner) || property.owner;
  const internet = safeParse(req.body.internet) || property.internet;
  const utility = safeParse(req.body.utility) || property.utility;
  const agreement = safeParse(req.body.agreement) || property.agreement;

  const getFiles = (key) => files?.[key] || [];

  const existingAadhar = req.body.owner?.aadharCardExisting
    ? (Array.isArray(req.body.owner.aadharCardExisting)
      ? req.body.owner.aadharCardExisting
      : [req.body.owner.aadharCardExisting])
    : [];

  const existingPhoto = req.body.owner?.photoExisting
    ? (Array.isArray(req.body.owner.photoExisting)
      ? req.body.owner.photoExisting
      : [req.body.owner.photoExisting])
    : [];

  // 📸 PHOTO UPDATE
  if (getFiles("owner[photo]").length > 0) {
    const photoUploads = await Promise.all(
      getFiles("owner[photo]").map((file) =>
        uploadFile(file, `properties/${propertyCode}`)
      )
    );

    // ✅ ADD (merge instead of replace)
    owner.photo = [...existingPhoto, ...photoUploads];
  } else {
    // ✅ ADD
    owner.photo = existingPhoto;
  }

  // 📄 AADHAR UPDATE
  if (getFiles("owner[aadharCard]").length > 0) {
    const aadharUploads = await Promise.all(
      getFiles("owner[aadharCard]").map((file) =>
        uploadFile(file, `properties/${propertyCode}`)
      )
    );

    // ✅ ADD (merge instead of replace)
    owner.aadharCard = [...existingAadhar, ...aadharUploads];
  } else {
    // ✅ ADD
    owner.aadharCard = existingAadhar;
  }
  // UPDATE FINAL DATA
  const updatedProperty = await Property.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
      owner,
      internet,
      utility,
      agreement,
    },
    {
      new: true,
      runValidators: true,
    }
  );
  console.timeEnd("Total Update");
  res.status(200).json({
    success: true,
    message: "Property updated successfully",
    data: updatedProperty,
  });
});

const mongoose = require("mongoose");
// DELETE
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
const deleteMultipleProperties = asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, "Please provide property ids.");
  }

  const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));

  if (invalidIds.length) {
    throw new ApiError(400, "One or more property ids are invalid.");
  }

  const result = await Property.deleteMany({
    _id: { $in: ids },
  });

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} propert${result.deletedCount === 1 ? "y" : "ies"} deleted successfully.`,
    deletedCount: result.deletedCount,
  });
});



// ADD WORKLOG
const addWorklog = asyncHandler(async (req, res) => {
  const property = await Property.findByIdAndUpdate(
    req.params.id,
    {
      $push: {
        worklogs: {
          message: req.body.message,
          createdAt: new Date(),
        },
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  res.status(200).json({
    success: true,
    message: "Worklog added successfully",
    data: property,
  });
});

// Property Dropdown List

const getPropertyDropdown = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = req.query.search?.trim() || "";

    const query = {};

    if (search) {
      query.propertyCode = {
        $regex: search,
        $options: "i",
      };
    }
    const [locations, bedCounts, totalRecords, statuses, properties] =
      await Promise.all([
        Property.distinct("propertyLocation"),
        Property.distinct("bedCount"),
        Property.countDocuments(query),
        Property.distinct("status"),
        Property.find(query)
          .select("_id propertyCode propertyLocation bedCount status")
          .sort({ propertyCode: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);
    locations.sort();
    bedCounts.sort((a, b) => a - b);
    return res.status(200).json({
      success: true,
      data: properties,
      locations,
      bedCounts,
      statuses,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      hasMore: page * limit < totalRecords,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch properties.",
    });
  }
};




module.exports = {
  createProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  addWorklog,
  deleteMultipleProperties,
  getPropertyDropdown
};