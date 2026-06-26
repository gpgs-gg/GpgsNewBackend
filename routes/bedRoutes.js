const express = require("express");
const router = express.Router();

const {
  createBed,
  getBeds,
  getSingleBed,
  updateBed,
  deleteBed,
} = require("../controllers/bedController");

router.post("/", createBed);

router.get("/", getBeds);

router.get("/:id", getSingleBed); 

router.put("/:id", updateBed);

router.delete("/:id", deleteBed);

module.exports = router;