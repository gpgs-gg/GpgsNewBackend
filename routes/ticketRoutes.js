const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");

const {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  addWorkLog,
  getTicketNavigation,
  exportTickets,
  exportTicketsPDF
} = require("../controllers/ticketController");
const { verifyJWT } = require("../middleware/verifyJWT");

// CREATE
router.post(
  "/",
  upload.array("attachment", 20),verifyJWT,
  createTicket
);

// READ ALL
router.get("/",verifyJWT,getAllTickets);
router.get("/navigation/:id",verifyJWT,  getTicketNavigation);

// READ SINGLE
router.get("/:id",verifyJWT, getTicketById);

// UPDATE
router.put(
  "/:id",
  upload.array("attachment", 20),verifyJWT,
  updateTicket
);

// DELETE
router.delete("/:id",verifyJWT, deleteTicket);

// ADD WORKLOG
router.post("/:id/worklog",verifyJWT, addWorkLog);
router.post("/export",verifyJWT, exportTickets);
router.post("/export-pdf", verifyJWT, exportTicketsPDF);

module.exports = router;