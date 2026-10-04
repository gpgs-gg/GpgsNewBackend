const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middleware/verifyJWT");
const { createPropertySequenceBulk, getAllPropertySequences } = require("../controllers/propertySequenceController");


router.post("/property-sequence/bulk", verifyJWT , createPropertySequenceBulk);
router.get("/property-sequence",verifyJWT, getAllPropertySequences);
module.exports = router;