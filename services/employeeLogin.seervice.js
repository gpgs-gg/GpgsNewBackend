const mongoose = require("mongoose");
const Employee = require("../models/employee.model");
const User = require("../models/user.model");

const toggleEmployeeLogin = async (employeeId) => {
  // Validate ObjectId first
  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    throw new Error("Invalid employee ID");
  }

  const employee = await Employee.findById(employeeId);

  if (!employee) {
    throw new Error("Employee not found");
  }

  if (!employee.email) {
    throw new Error("Employee email is required to enable login");
  }

  const email = employee.email.trim().toLowerCase();

  // Toggle employee login status
  const newLoginEnabled = !employee.loginEnabled;

  employee.loginEnabled = newLoginEnabled;
  await employee.save();

  // Find employee user
  let user = await User.findOne({
    email,
    role: "Employee",
  });

  // ============================================================
  // DISABLE LOGIN
  // ============================================================
  if (!newLoginEnabled) {
    if (user) {
      user.isActive = false;

      // IMPORTANT:
      // User.employeeId must contain Employee MongoDB _id
      user.employeeId = employee._id;

      await user.save();
    }

    return {
      loginEnabled: false,
      isActive: false,
      employeeId: employee._id,
      employeeIdLable: employee.employeeId,
    };
  }

  // ============================================================
  // ENABLE LOGIN
  // ============================================================

  // Existing employee user
  if (user) {
    user.name = employee.employeeName;
    user.email = email;
    user.role = "Employee";
    user.employeeId = employee._id;

    // Reactivate user
    user.isActive = true;

    await user.save();

    return {
      loginEnabled: true,
      isActive: true,
      employeeId: employee._id,
      employeeIdLable: employee.employeeId,
    };
  }

  // ============================================================
  // CREATE NEW EMPLOYEE USER
  // ============================================================

  user = await User.create({
    name: employee.employeeName,
    email,
    password: "123456",
    role: "Employee",
    isActive: true,

    // IMPORTANT
    employeeId: employee._id,
    employeeIdLable: employee.employeeId,
  });

  return {
    loginEnabled: true,
    isActive: true,
    employeeId: employee._id,
  };
};

module.exports = {
  toggleEmployeeLogin,
};