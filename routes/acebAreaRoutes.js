const express = require("express");

const {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty
} = require("../controllers/acebAreaController");
const { verifyJWT } = require("../middleware/verifyJWT");
const router = express.Router();

router.post("/",verifyJWT, createProperty);

router.get("/", verifyJWT,  getProperties);

router.get("/:id", verifyJWT,  getPropertyById);

router.put("/:id",verifyJWT, updateProperty);

router.delete("/:id",verifyJWT, deleteProperty);

module.exports = router;