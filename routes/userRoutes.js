const express = require("express");
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserDropdown,
} = require("../controllers/UserContoller");
const { verifyJWT } = require("../middleware/verifyJWT");


router.get("/",verifyJWT, getAllUsers);

router.get("/dropdown",verifyJWT, getUserDropdown);

router.get("/:id",verifyJWT, getUserById);

router.put("/:id",verifyJWT, updateUser);

router.delete("/:id",verifyJWT, deleteUser);

module.exports = router;