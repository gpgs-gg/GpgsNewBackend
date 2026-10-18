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
  getLoginEnabledEmployeesController,getManagerEmployees
} = require("../controllers/EmployeesController");
const {verifyJWT} = require("../middleware/verifyJWT");

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

router.post("/login", verifyJWT, LoginUser);

// ============================================================
// EMPLOYEE LIST
// IMPORTANT: THIS MUST COME BEFORE /:id
// ============================================================

router.get("/",verifyJWT, getEmployeeDetails);

// ============================================================
// CREATE EMPLOYEE
// ============================================================

router.post("/",verifyJWT, createEmployee);
// Get employees whose login is enabled
router.get("/login-enabled", verifyJWT, getLoginEnabledEmployeesController);
// ============================================================
// EMPLOYEE WORKLOGS - STATIC ROUTES FIRST
// ============================================================

// If you don't have these under /employees/:id,
// keep them before /:id where appropriate.

// ============================================================
// SINGLE EMPLOYEE
// ============================================================
router.get("/managers",verifyJWT, getManagerEmployees);
router.patch("/toggle-login",verifyJWT, toggleEmployeeLoginController);
router.get("/:id",verifyJWT, getEmployeeById);

router.put("/:id",verifyJWT, updateEmployee);

router.delete("/:id",verifyJWT, deleteEmployee);


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
  verifyJWT,
  EmployeeDocumentUpload,
);

module.exports = router;
