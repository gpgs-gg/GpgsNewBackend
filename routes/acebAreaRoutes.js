const express = require("express");

const {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty
} = require("../controllers/acebAreaController");

const router = express.Router();

router.post("/", createProperty);

router.get("/", getProperties);

router.get("/:id", getPropertyById);

router.put("/:id", updateProperty);

router.delete("/:id", deleteProperty);

module.exports = router;