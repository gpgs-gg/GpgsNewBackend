const express = require("express");
const router = express.Router();

const {
  createBed,
  getBeds,
  getSingleBed,
  updateBed,
  deleteBed,
  deleteMultipleBeds,
  getBedsUpcomingRentHike
} = require("../controllers/bedController");
const {verifyJWT} = require("../middleware/verifyJWT");

router.post("/",verifyJWT, createBed);
router.get(
  "/upcoming-rent-hike",
  // verifyJWT,
  getBedsUpcomingRentHike
);

router.get("/",verifyJWT, getBeds);

router.get("/:id",verifyJWT, getSingleBed); 

router.put("/:id",verifyJWT, updateBed);

router.delete("/:id",verifyJWT, deleteBed);
router.delete("/",verifyJWT, deleteMultipleBeds); // Bulk delete

module.exports = router;