const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");

const {
  createProperty,
  getAllProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  addWorklog,
  getPropertyDropdown
} = require("../controllers/propertyController");


router.get("/dropdown", getPropertyDropdown);

router.post("/", upload.fields([
    { name: "owner[photo]", maxCount: 10 },
    { name: "owner[aadharCard]", maxCount: 10 },
  ]),createProperty
);
router.get("/", getAllProperties);
router.get("/:id", getPropertyById);
router.put(
  "/:id",
  upload.fields([
    { name: "owner[photo]", maxCount: 10 },
    { name: "owner[aadharCard]", maxCount: 10 },
  ]),
  updateProperty
);
router.delete("/:id", deleteProperty);
router.post("/:id/worklog", addWorklog);



// ............


module.exports = router;