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
  const properties = await Property.find().sort({ createdAt: -1 }); // Latest records first

  res.status(200).json({
    success: true,
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

  res.status(200).json({
    success: true,
    message: "Property updated successfully",
    data: updatedProperty,
  });
});

// DELETE
const deleteProperty = asyncHandler(async (req, res) => {
  const property = await Property.findByIdAndDelete(
    req.params.id
  );

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  res.status(200).json({
    success: true,
    message: "Property deleted successfully",
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
const getPropertyDropdown = asyncHandler(async (req, res) => {
  try {
    const properties = await Property.find(
      { status: "Active" }, // optional
      {
        _id: 1,
        propertyCode: 1,
        bedCount: 1,    
      }
    ).sort({ propertyCode: 1 });
    res.status(200).json({
      success: true,
      data: properties,
    });
     
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


module.exports = {
  createProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  addWorklog,
  getPropertyDropdown
};