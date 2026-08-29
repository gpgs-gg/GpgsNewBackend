const express = require("express");

const {
  createModule,
  getAllModules,
  getSingleModule,
  updateModule,
  deleteModule,
  toggleModuleStatus,
} = require("../controllers/sidebarModuleController");

const router = express.Router();

// Create Module
router.post("/", createModule);

// Get All Modules
router.get("/", getAllModules);

// Get Single Module
router.get("/:id", getSingleModule);

// Update Module
router.put("/:id", updateModule);

// Delete Module
router.delete("/:id", deleteModule);

// Toggle Active / Inactive
router.patch("/:id/toggle-status", toggleModuleStatus);

module.exports = router;