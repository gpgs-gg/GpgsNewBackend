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
  verifyJWT,
  createTicket
);

// READ ALL
router.get("/", verifyJWT, getAllClientTickets);
router.get("/client-details/:clientId", verifyJWT, getClientDetailsById);
router.get("/navigation/:id",verifyJWT,  getTicketNavigation);

// READ SINGLE
router.get("/:id",verifyJWT, getTicketById);

// UPDATE
router.put(
  "/:id",
  upload.array("attachment", 20),
  verifyJWT,
  updateTicket
);


// DELETE
router.delete("/:id",verifyJWT, deleteTicket);

// ADD WORKLOG


module.exports = router;