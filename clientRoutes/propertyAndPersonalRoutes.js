
const express = require("express");

const router = express.Router();

const {
  getPropertyAndPersonalDetailsById,
} = require("../clientControllers/propertyAndPersonalController");

// Get Single Client
router.get("/client-perso-pro-details/:id", getPropertyAndPersonalDetailsById);

module.exports = router;
