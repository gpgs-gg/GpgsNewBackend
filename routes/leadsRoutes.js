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
  bulkTransferLeads,
} = require("../controllers/LeadsContoller");

const {verifyJWT} = require("../middleware/verifyJWT");

// ================= LEAD ROUTES =================
// Create Lead
router.post("/",verifyJWT, createLead);

// Bulk Create Lead
router.post("/bulk",verifyJWT, bulkCreateLead);

// Get All Leads
router.get("/",verifyJWT, getAllLeads);

// Dropdown Data
router.get("/dropdown",verifyJWT, getLeadDropdown);
router.put("/bulk-transfer",verifyJWT,  bulkTransferLeads);
// Navigation (Previous / Next)
router.get("/navigation/:id",verifyJWT, getLeadNavigation);

// Get Single Lead
router.get("/:id",verifyJWT, getLeadById);

// Update Lead
router.put("/:id",verifyJWT, updateLead);

// Delete Lead
router.delete("/:id",verifyJWT, deleteLead);

// Add Work Log
router.post("/:id/worklog",verifyJWT,addWorkLog);
module.exports = router;