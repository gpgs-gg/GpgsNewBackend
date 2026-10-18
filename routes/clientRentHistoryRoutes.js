const express = require("express");
const router = express.Router();

const {
 createClientRentHistory,
 updateClientRentHistory,
 getClientRentHistory,
 getClientRentHistoryById,
 getClientRentHistoryByBookingId, deleteClientRentHistory ,exportClientRentData
} = require("../controllers/ClientRentHistoryController");
const {verifyJWT} = require("../middleware/verifyJWT");


router.post("/",verifyJWT, createClientRentHistory);

router.get("/",verifyJWT, getClientRentHistory);

router.get("/:id",verifyJWT, getClientRentHistoryById); 

// router.get("/client/:clientId", getClientCompleteRentHistory);
router.get(
  "/renthistoryfrombooking/:bookingId", verifyJWT,
 getClientRentHistoryByBookingId
);
router.put("/:id",verifyJWT, updateClientRentHistory);  

router.delete("/:id",verifyJWT, deleteClientRentHistory);
router.post("/export", exportClientRentData);

module.exports = router;