const express = require("express");
const router = express.Router();
const {
  getAllRNRClients,
} = require("../controllers/RnrController");

router.get("/new-rnr", getAllRNRClients);

module.exports = router;