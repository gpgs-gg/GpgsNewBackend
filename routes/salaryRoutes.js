const express = require("express");

const router = express.Router();
const { verifyJWT } = require("../middleware/verifyJWT");

const {
  getSalaries,
  getEmployeeSalary,
  getEmployeeExistingSalaries,
  upsertEmployeeSalary,
} = require("../controllers/SalaryController");

router.get("/",verifyJWT, getSalaries);

router.get("/employee",verifyJWT, getEmployeeSalary);

// Get all existing salary records of an employee
router.get("/employee/existing-salaries",verifyJWT, getEmployeeExistingSalaries);

router.patch("/employee/:employeeId",verifyJWT, upsertEmployeeSalary);

module.exports = router;