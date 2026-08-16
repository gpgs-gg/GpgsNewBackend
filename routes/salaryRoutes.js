const express = require("express");

const router = express.Router();

const {
  getSalaries,
  getEmployeeSalary,
  upsertEmployeeSalary,
} = require("../controllers/SalaryController");

router.get("/", getSalaries);

router.get("/employee", getEmployeeSalary);

router.patch("/employee/:employeeId", upsertEmployeeSalary);

module.exports = router;