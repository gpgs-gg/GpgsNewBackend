const express = require("express");

const router = express.Router();

const {
  createClient,
  updateClient,
  getClients,
  getClientById,
  deleteClient,
  getAvailableBeds,
  createClientFromBooking
} = require("../controllers/ClientController");

// Create Client
router.post("/", createClient);

// Get All Clients
router.get("/", getClients);

// Get Single Client
router.get("/:id", getClientById);

// Update Client
router.put("/:id", updateClient);

// Delete Client
router.delete("/:id", deleteClient);

// Booking -> Client Conversion
router.post(
  "/create-from-booking",
  createClientFromBooking
);

module.exports = router;