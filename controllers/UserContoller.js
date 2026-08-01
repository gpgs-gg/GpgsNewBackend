const User = require("../models/user.model");
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");
// ==========================
// GET ALL USERS
// ==========================
const getAllUsers = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 10, 1);

  const skip = (page - 1) * limit;

  const query = {};

  // Search
  if (req.query.search) {
    query.$or = [
      {
        name: {
          $regex: req.query.search,
          $options: "i",
        },
      },
      {
        email: {
          $regex: req.query.search,
          $options: "i",
        },
      },
    ];
  }

  // Filters
  if (req.query.userId) {
    query._id = req.query.userId;
  }

  if (req.query.role) {
    query.role = req.query.role;
  }

  if (req.query.isActive !== undefined) {
    query.isActive = req.query.isActive === "true";
  }

  const totalRecords = await User.countDocuments(query);

  const users = await User.find(query)
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
    count: users.length,
    data: users,
  });
});


// ==========================
// GET USER BY ID
// ==========================
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)


  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});


// ==========================
// UPDATE USER
// ==========================
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Email Duplicate Check
  if (
    req.body.email &&
    req.body.email !== user.email
  ) {
    const existingEmail = await User.findOne({
      email: req.body.email,
      _id: {
        $ne: req.params.id,
      },
    });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }
  }

  if (req.body.password) {
    user.password = req.body.password;
  }

  user.name = req.body.name ?? user.name;
  user.email = req.body.email ?? user.email;
  user.role = req.body.role ?? user.role;
  user.bookingId = req.body.bookingId || null;
  user.employeeId = req.body.employeeId || null;

  if (req.body.isActive !== undefined) {
    user.isActive = req.body.isActive;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: "User updated successfully",
    data: user,
  });
});


// ==========================
// DELETE USER
// ==========================
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});


// ==========================
// USER DROPDOWN
// ==========================
const getUserDropdown = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const search = req.query.search?.trim() || "";

  const query = {};

  if (search) {
    query.name = {
      $regex: search,
      $options: "i",
    };
  }

  const [roles, totalRecords, users] = await Promise.all([
    User.distinct("role"),
    User.countDocuments(query),
    User.find(query)
      .select("_id name email role isActive")
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    data: users,
    roles,
    page,
    limit,
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
    hasMore: page * limit < totalRecords,
  });
});

module.exports = {
//   createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserDropdown,
};