const express = require("express");
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserDropdown,
} = require("../controllers/UserContoller");


router.get("/", getAllUsers);

router.get("/dropdown", getUserDropdown);

router.get("/:id", getUserById);

router.put("/:id", updateUser);

router.delete("/:id", deleteUser);

module.exports = router;