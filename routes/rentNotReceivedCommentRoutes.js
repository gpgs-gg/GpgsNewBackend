const express = require("express");

const {
  addRentNotReceivedComment,
} = require("../controllers/rentNotReceivedCommentController");

const router = express.Router();
const { verifyJWT } = require("../middleware/verifyJWT");

router.post(
  "/rent-not-received/comment",verifyJWT,
  addRentNotReceivedComment
);

module.exports = router;