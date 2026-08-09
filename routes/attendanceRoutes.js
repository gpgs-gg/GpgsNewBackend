const express = require("express");

const router = express.Router();

const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMyAttendance,
  getAllAttendance,
  getAttendanceById,
  updateAttendance,
} = require("../controllers/AttendanceController");

const { verifyJWT } = require("../middleware/verifyJWT");

const upload = require("../middleware/uploadMiddleware");

// ======================================================
// EMPLOYEE ATTENDANCE
// ======================================================

// Check In
router.post(
  "/check-in",
  verifyJWT,

  upload.single("selfie"),
  checkIn,
);

// Check Out
router.post("/check-out", verifyJWT, upload.single("selfie"), checkOut);

// Today's attendance
router.get("/today", verifyJWT, getTodayAttendance);

// Logged-in employee attendance history
router.get("/my", verifyJWT, getMyAttendance);

// ======================================================
// ADMIN / HR ATTENDANCE
// ======================================================

// All attendance
router.get("/", verifyJWT, getAllAttendance);

// Single attendance
router.get("/:id", verifyJWT, getAttendanceById);

// Update attendance
router.put("/:id", verifyJWT, updateAttendance);

module.exports = router;