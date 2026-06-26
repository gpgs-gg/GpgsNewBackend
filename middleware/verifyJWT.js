const jwt = require("jsonwebtoken");
const asyncHandler = require("../middleware/asyncHandler");
const User = require("../models/user.model"); // check this path

const verifyJWT = asyncHandler(async (req, res, next) => {

  try {
   const token =
  req.cookies?.accessToken ||
  req.header("Authorization")?.replace("Bearer ", "");
     
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
   console.log(token)
    const decodedToken = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid access token",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || "Invalid access token",
    });
  }
});

module.exports = {
  verifyJWT,
};