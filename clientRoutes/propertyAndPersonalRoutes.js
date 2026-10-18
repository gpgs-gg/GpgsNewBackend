
const express = require("express");

const router = express.Router();
const { verifyJWT } = require("../middleware/verifyJWT");

const {
  getPropertyAndPersonalDetailsById,
} = require("../clientControllers/propertyAndPersonalController");

// Get Single Client
router.get("/client-perso-pro-details/:id",verifyJWT, getPropertyAndPersonalDetailsById);

module.exports = router;
