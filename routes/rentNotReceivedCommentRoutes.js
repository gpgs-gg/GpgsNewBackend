const express = require("express");

const {
  addRentNotReceivedComment,
} = require("../controllers/rentNotReceivedCommentController");

const router = express.Router();

router.post(
  "/rent-not-received/comment",
  addRentNotReceivedComment
);

module.exports = router;