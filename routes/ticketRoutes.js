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
} = require("../controllers/ticketController");
const { verifyJWT } = require("../middleware/verifyJWT");

// CREATE
router.post(
  "/",
  upload.array("attachment", 20),
  createTicket
);

// READ ALL
router.get("/",  getAllTickets);

// READ SINGLE
router.get("/:id", getTicketById);

// UPDATE
router.put(
  "/:id",
  upload.array("attachment", 20),
  updateTicket
);

// DELETE
router.delete("/:id", deleteTicket);

// ADD WORKLOG
router.post("/:id/worklog", addWorkLog);

module.exports = router;