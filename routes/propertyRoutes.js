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
  getPropertyDropdown,
  deleteMultipleProperties
} = require("../controllers/propertyController");
const { verifyJWT } = require("../middleware/verifyJWT");

router.get("/dropdown",verifyJWT, getPropertyDropdown);

router.post("/", upload.fields([
  { name: "owner[photo]", maxCount: 10 },
  { name: "owner[aadharCard]", maxCount: 10 },
  { name: "agreement[attachment]", maxCount: 10, }

]),verifyJWT, createProperty
);
router.get("/", verifyJWT, getAllProperties);
router.get("/:id",verifyJWT, getPropertyById);
router.put(
  "/:id",
  upload.fields([
    { name: "owner[photo]", maxCount: 10 },
    { name: "owner[aadharCard]", maxCount: 10 },
    { name: "agreement[attachment]", maxCount: 10, }
  ]),verifyJWT,
  updateProperty
);
router.delete("/:id",verifyJWT, deleteProperty);
router.delete("/",verifyJWT, deleteMultipleProperties);
router.post("/:id/worklog",verifyJWT, addWorklog);



// ............


module.exports = router;