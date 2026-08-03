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

router.get("/", getAllOptionsData);
router.get("/batch", getBatchOptions); 
router.get("/:id", getOptionsDataById);
router.post("/", createOptionsData);
router.put("/:id", updateOptionsData);
router.delete("/:id", deleteOptionsData);
router.get("/category/:categoryKey", getOptionsDataByCategory);

module.exports = router;