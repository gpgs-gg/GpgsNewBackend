const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");

const {
  createTicket,
    getTicketById,
    updateTicket,
    deleteTicket,
    getTicketNavigation,
    getClientDetailsById,
    getAllClientTickets,
} = require("../clientControllers/cleintTicketController");
const { verifyJWT } = require("../middleware/verifyJWT");

// CREATE
router.post(
  "/",
  upload.array("attachment", 20),
  createTicket
);

// READ ALL
router.get("/",  getAllClientTickets);
router.get("/client-details/:clientId",  getClientDetailsById);
router.get("/navigation/:id",  getTicketNavigation);

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


module.exports = router;