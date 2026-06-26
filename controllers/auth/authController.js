const User = require("../../models/user.model");
const asyncHandler = require("../../middleware/asyncHandler");
const jwt = require("jsonwebtoken");
/* =========================
   COOKIE CONFIG (IMPORTANT)
   VPS HTTP = secure:false
   HTTPS = secure:true
========================= */
const options = {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
};

/* =========================
   REGISTER
========================= */
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "User already exists",
    });
  }

  const user = await User.create({ name, email, password });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  return res.status(201).json({
    success: true,
    message: "User registered successfully",
    user: createdUser,
  });
});

/* =========================
   LOGIN
========================= */
const loginUser = asyncHandler(async (req, res) => {

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: "Your account is inactive. Contact admin.",
    });
  }
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, {
      ...options,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .cookie("refreshToken", refreshToken, {
      ...options,
      maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
    })
    .json({
      success: true,
      message: "Login successful",
      user: loggedInUser,
    });
});

/* =========================
   LOGOUT
========================= */
const logoutUser = asyncHandler(async (req, res) => {
  if (!req.user?._id) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  await User.findByIdAndUpdate(req.user._id, {
    $unset: { refreshToken: 1 },
  });

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json({
      success: true,
      message: "Logged out successfully",
    });
});

/* =========================
   REFRESH TOKEN
========================= */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken;

  if (!incomingRefreshToken) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized request",
    });
  }

  try {
    const decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decoded?._id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    if (incomingRefreshToken !== user.refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token expired or reused",
      });
    }

    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .cookie("accessToken", newAccessToken, {
        ...options,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .cookie("refreshToken", newRefreshToken, {
        ...options,
        maxAge: 15 * 24 * 60 * 60 * 1000,
      })
      .json({
        success: true,
        message: "Token refreshed successfully",
      });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
});

/* =========================
   GET CURRENT USER
========================= */
const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
});

// UPDATE PASSWORD ONLY FOR ACTIVE USER
const updatePassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Email and new password are required",
    });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  // Only active users
  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: "Inactive users cannot update password",
    });
  }

  user.password = newPassword;

  await user.save();

  return res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getCurrentUser,
  updatePassword,
};