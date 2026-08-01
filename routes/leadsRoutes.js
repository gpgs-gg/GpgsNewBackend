const express = require("express");
const router = express.Router();

const {
  createLead,
  bulkCreateLead,
  getAllLeads,
  getLeadById,
  getLeadNavigation,
  updateLead,
  deleteLead,
  addWorkLog,
  getLeadDropdown,
} = require("../controllers/LeadsContoller");


// ================= LEAD ROUTES =================
// Create Lead
router.post("/",createLead);

// Bulk Create Lead
router.post("/bulk",bulkCreateLead);

// Get All Leads
router.get("/",getAllLeads);

// Dropdown Data
router.get("/dropdown",getLeadDropdown);

// Navigation (Previous / Next)
router.get("/navigation/:id",getLeadNavigation);

// Get Single Lead
router.get("/:id",getLeadById);

// Update Lead
router.put("/:id",updateLead);

// Delete Lead
router.delete("/:id",deleteLead);

// Add Work Log
router.post("/:id/worklog",addWorkLog);
module.exports = router;