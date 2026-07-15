const express = require("express");
const router = express.Router();

const { verifyJWT } = require("../middleware/verifyJWT");
const {
  toggleClientLogin,
} = require("../controllers/toggleClientLogin");


router.patch(
  "/:id",
  verifyJWT,
  toggleClientLogin
);

module.exports = router;