const express = require("express");

const router = express.Router();

const {
  getSalaries,
  getEmployeeSalary,
  getEmployeeExistingSalaries,
  upsertEmployeeSalary,
} = require("../controllers/SalaryController");

router.get("/", getSalaries);

router.get("/employee", getEmployeeSalary);

// Get all existing salary records of an employee
router.get("/employee/existing-salaries", getEmployeeExistingSalaries);

router.patch("/employee/:employeeId", upsertEmployeeSalary);

module.exports = router;