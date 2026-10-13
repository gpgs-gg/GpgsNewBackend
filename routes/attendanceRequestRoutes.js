const express = require("express");
const multer = require("multer");

const {
  createAttendanceRequest,
  getAllAttendanceRequests,
  getAttendanceRequestById,
  updateAttendanceRequestStatus,
  deleteAttendanceRequest,
  getAttendanceRequestsByRequestedTo,
} = require("../controllers/AttendanceRequestController");

const { verifyJWT } = require("../middleware/verifyJWT");

const router = express.Router();

// ============================================================
// MULTER CONFIGURATION
// Same memory-storage approach as the employee routes
// ============================================================

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Maximum 5 MB
  },
});

// ============================================================
// CREATE ATTENDANCE REQUEST
// ============================================================

router.post(
  "/",
  verifyJWT,
  upload.single("attachment"),
  createAttendanceRequest,
);

// ============================================================
// GET ALL ATTENDANCE REQUESTS
// Supports requestedBy, requestedTo and status filters
// ============================================================

router.get("/", verifyJWT, getAllAttendanceRequests);

// ============================================================
// GET REQUESTS ASSIGNED TO LOGGED-IN MANAGER
// ============================================================

router.get("/assigned-to-me", verifyJWT, getAttendanceRequestsByRequestedTo);

// ============================================================
// GET SINGLE ATTENDANCE REQUEST
// ============================================================

router.get("/:id", verifyJWT, getAttendanceRequestById);

// ============================================================
// APPROVE OR REJECT ATTENDANCE REQUEST
// ============================================================

router.patch("/:id/status", verifyJWT, updateAttendanceRequestStatus);

// ============================================================
// DELETE ATTENDANCE REQUEST
// ============================================================

router.delete("/:id", verifyJWT, deleteAttendanceRequest);

module.exports = router;