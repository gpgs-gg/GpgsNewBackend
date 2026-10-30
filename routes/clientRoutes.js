
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
  // createDummyClients,
  getNoticeClients,
  getClientsWithLatestRentHistory,
  generateSingleClientMonthlyRent,
  generateMonthlyRent,
  enableClientLoginController
} = require("../controllers/ClientController");
const upload = require("../middleware/uploadMiddleware");
const {verifyJWT} = require("../middleware/verifyJWT");

// Create Client
router.post("/",verifyJWT, createClient);
router.post("/generate-single-client-monthly-rent/:clientId",verifyJWT, generateSingleClientMonthlyRent);
router.post(
  "/generate-monthly-rent",verifyJWT,
  generateMonthlyRent
);
// Get All Clients
router.get("/", verifyJWT,getClients);
router.get("/notice", verifyJWT, getNoticeClients);
router.get(
  "/rent-not-received",verifyJWT,
  getClientsWithLatestRentHistory
);
// Get Single Client
router.get("/:id",verifyJWT, getClientById);

// Update Client
router.put("/:id", upload.fields([
  { name: "photo", maxCount: 10 },
  { name: "aadhaarCard", maxCount: 10 },
  { name: "collegeIdentification", maxCount: 10 },
  { name: "clientRentalAgreement", maxCount: 10 },
  { name: "clientPoliceNOC", maxCount: 10 },
  { name: "handoverAttachment", maxCount: 10 },
]),verifyJWT, updateClient);

// Delete Client
router.delete("/:id",verifyJWT, deleteClient);

// Booking -> Client Conversion
router.post(
  "/create-from-booking",verifyJWT,
  createClientFromBooking
);
// router.post("/dummy-clients", createDummyClients);


router.patch(
  "/booking/:bookingId/enable-login",
  verifyJWT,
  enableClientLoginController,
);

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