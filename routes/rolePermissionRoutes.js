const express = require("express");

const router = express.Router();
const { verifyJWT } = require("../middleware/verifyJWT");
const {
  upsertEmployeePermissions,
  getEmployeePermissions,
  getMyPermissions,
  deleteEmployeePermissions,
} = require("../controllers/rolePermisssionController");

// Current logged-in user's permissions/sidebar
router.get("/my", verifyJWT, getMyPermissions);

// Admin permission-management page
router.get("/employee/:employeeId",verifyJWT, getEmployeePermissions);

// Create or update employee permissions
router.put("/employee/:employeeId",verifyJWT, upsertEmployeePermissions);

// Reset employee permissions
router.delete("/employee/:employeeId",verifyJWT, deleteEmployeePermissions);

module.exports = router;