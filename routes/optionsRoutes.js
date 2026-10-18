const express = require("express");
const router = express.Router();

const {
  getAllOptionsData,
  getOptionsDataById,
  createOptionsData,
  updateOptionsData,
  deleteOptionsData,
  getOptionsDataByCategory,
  getBatchOptions 
} = require("../controllers/OptionsController");
const {verifyJWT} = require("../middleware/verifyJWT");

router.get("/",verifyJWT, getAllOptionsData);
router.get("/batch",verifyJWT, getBatchOptions); 
router.get("/:id",verifyJWT, getOptionsDataById);
router.post("/",verifyJWT, createOptionsData);
router.put("/:id",verifyJWT, updateOptionsData);
router.delete("/:id",verifyJWT, deleteOptionsData);
router.get("/category/:categoryKey",verifyJWT, getOptionsDataByCategory);

module.exports = router;