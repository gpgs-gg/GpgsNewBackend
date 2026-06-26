const express = require("express");
const router = express.Router();

const {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  getCurrentUser,
  updatePassword,
} = require("../controllers/auth/authController");

const { verifyJWT } = require("../middleware/verifyJWT");

router.post("/register", registerUser);
router.post("/login", (req, res, next) => {
  next();
}, loginUser);
router.post("/update-password", updatePassword);

// secured routes
router.post("/logout", verifyJWT, logoutUser);
router.post("/refresh-token", refreshAccessToken);
router.get("/me", verifyJWT, getCurrentUser);

module.exports = router;