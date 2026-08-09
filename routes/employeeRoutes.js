const express = require("express");
const multer = require("multer");

const {
  LoginUser,
  getEmployeeDetails,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  EmployeeDocumentUpload,
  toggleEmployeeLoginController,
  getLoginEnabledEmployeesController,
} = require("../controllers/EmployeesController");

const router = express.Router();

// ============================================================
// MULTER CONFIGURATION
// ============================================================

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// ============================================================
// LOGIN
// ============================================================

router.post("/login", LoginUser);

// ============================================================
// EMPLOYEE LIST
// IMPORTANT: THIS MUST COME BEFORE /:id
// ============================================================

router.get("/", getEmployeeDetails);

// ============================================================
// CREATE EMPLOYEE
// ============================================================

router.post("/", createEmployee);
// Get employees whose login is enabled
router.get("/login-enabled", getLoginEnabledEmployeesController);
// ============================================================
// EMPLOYEE WORKLOGS - STATIC ROUTES FIRST
// ============================================================

// If you don't have these under /employees/:id,
// keep them before /:id where appropriate.

// ============================================================
// SINGLE EMPLOYEE
// ============================================================

router.get("/:id", getEmployeeById);

router.put("/:id", updateEmployee);

router.delete("/:id", deleteEmployee);
router.patch("/toggle-login", toggleEmployeeLoginController);

// ============================================================
// EMPLOYEE DOCUMENTS
// ============================================================

router.post(
  "/:id/documents",
  upload.fields([
    {
      name: "aadharCard",
      maxCount: 2,
    },
    {
      name: "photo",
      maxCount: 1,
    },
    {
      name: "bankPassbook",
      maxCount: 1,
    },
  ]),
  EmployeeDocumentUpload,
);

module.exports = router;
