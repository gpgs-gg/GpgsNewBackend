const express = require("express");
const router = express.Router();

const {
 createClientRentHistory,
 updateClientRentHistory,
 getClientRentHistory,
 getClientRentHistoryById,
 getClientCompleteRentHistory,
 getClientRentHistoryByBookingId
} = require("../controllers/ClientRentHistoryController");

router.post("/", createClientRentHistory);

router.get("/", getClientRentHistory);

router.get("/:id", getClientRentHistoryById); 

// router.get("/client/:clientId", getClientCompleteRentHistory);
router.get(
  "/renthistoryfrombooking/:bookingId",
 getClientRentHistoryByBookingId
);
router.put("/:id", updateClientRentHistory);

// router.delete("/:id", rentHistory);

module.exports = router;