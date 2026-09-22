const express = require("express");
const router = express.Router();
const {
  createBooking,
  getAllBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
  cancelBooking
} = require("../controllers/NewBookingController");
const { verifyJWT } = require("../middleware/verifyJWT");
router.post("/", verifyJWT, createBooking);
router.get("/", verifyJWT, getAllBookings);
router.get("/:id",verifyJWT, getBookingById);
router.put("/:id", verifyJWT, updateBooking);
router.delete("/:id", verifyJWT, deleteBooking);
router.put("/cancel/:id",verifyJWT, cancelBooking);
module.exports = router;