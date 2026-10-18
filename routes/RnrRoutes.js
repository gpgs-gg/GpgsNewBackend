const express = require("express");
const router = express.Router();
const {
  getAllRNRClients,
} = require("../controllers/RnrController");
const { verifyJWT } = require("../middleware/verifyJWT");

router.get("/new-rnr",verifyJWT, getAllRNRClients);

module.exports = router;