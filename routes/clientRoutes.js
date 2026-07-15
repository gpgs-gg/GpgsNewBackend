
const express = require("express");

const router = express.Router();

const {
  createClient,
  updateClient,
  getClients,
  getClientById,
  deleteClient,
  getAvailableBeds,
  createClientFromBooking,
  createDummyClients
} = require("../controllers/ClientController");
const upload = require("../middleware/uploadMiddleware");

// Create Client
router.post("/", createClient);

// Get All Clients
router.get("/", getClients);

// Get Single Client
router.get("/:id", getClientById);

// Update Client
router.put("/:id",  upload.fields([
    { name: "photo", maxCount: 10 },
    { name: "aadhaarCard", maxCount: 10 },
    { name: "collegeIdentification", maxCount: 10 },
    { name: "clientRentalAgreement", maxCount: 10 },
    { name: "clientPoliceNOC", maxCount: 10 },
  ]), updateClient);

// Delete Client
router.delete("/:id", deleteClient);

// Booking -> Client Conversion
router.post(
  "/create-from-booking",
  createClientFromBooking
);
router.post("/dummy-clients", createDummyClients);

module.exports = router;

// const express = require("express");

// const router = express.Router();

// const {
//   createClient,
//   updateClient,
//   getClients,
//   getClientById,
//   deleteClient,
//   getAvailableBeds,
//   createClientFromBooking
// } = require("../controllers/ClientController");
// const upload = require("../middleware/uploadMiddleware");

// // Create Client
// router.post("/", createClient);

// // Get All Clients
// router.get("/", getClients);

// // Get Single Client
// router.get("/:id", getClientById);

// // Update Client
// router.put("/:id",  upload.fields([
//     { name: "photo", maxCount: 10 },
//     { name: "aadharCard", maxCount: 10 },
//     { name: "collegeIdentification", maxCount: 10 },
//     { name: "clientRentalAgreement", maxCount: 10 },
//     { name: "clientPoliceNOC", maxCount: 10 },
//   ]), updateClient);

// // Delete Client
// router.delete("/:id", deleteClient);

// // Booking -> Client Conversion
// router.post(
//   "/create-from-booking",
//   createClientFromBooking
// );

// module.exports = router;