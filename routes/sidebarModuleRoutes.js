const express = require("express");

const {
  createModule,
  getAllModules,
  getSingleModule,
  updateModule,
  deleteModule,
  toggleModuleStatus,
  getAllMenuModules,
} = require("../controllers/sidebarModuleController");
const { verifyJWT } = require("../middleware/verifyJWT");

const router = express.Router();

// Create Module
router.post("/",verifyJWT, createModule);

// Get All Modules
router.get("/",verifyJWT, getAllModules);
router.get("/menu",verifyJWT, getAllMenuModules);
// Get Single Module
router.get("/:id",verifyJWT, getSingleModule);

// Update Module
router.put("/:id",verifyJWT, updateModule);

// Delete Module
router.delete("/:id",verifyJWT, deleteModule);

// Toggle Active / Inactive
router.patch("/:id/toggle-status",verifyJWT, toggleModuleStatus);

module.exports = router;