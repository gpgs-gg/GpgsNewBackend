const express = require("express");
const router = express.Router();

const {
  createBed,
  getBeds,
  getSingleBed,
  updateBed,
  deleteBed,
  deleteMultipleBeds
} = require("../controllers/bedController");

router.post("/", createBed);

router.get("/", getBeds);

router.get("/:id", getSingleBed); 

router.put("/:id", updateBed);

router.delete("/:id", deleteBed);
router.delete("/", deleteMultipleBeds); // Bulk delete

module.exports = router;