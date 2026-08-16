const mongoose = require("mongoose");
const Employee = require("../models/employee.model");
const User = require("../models/user.model");

const toggleEmployeeLogin = async (employeeId) => {
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
  
  const newLoginEnabled = !employee.loginEnabled;

  if (!newLoginEnabled) {
    employee.loginEnabled = false;
    await employee.save();

    const user = await User.findOne({
      employeeId: employee._id,
    });

    if (user) {
      user.isActive = false;
      await user.save();
    }

    return {
      loginEnabled: false,
      isActive: false,
      employeeId: employee._id,
      employeeIdLable: employee.employeeId,
    };
  }

  const existingEmailUser = await User.findOne({
    email,
  });

  if (existingEmailUser) {
    if (
      existingEmailUser.employeeId &&
      String(existingEmailUser.employeeId) === String(employee._id)
    ) {
      existingEmailUser.name = employee.employeeName;
      existingEmailUser.email = email;
      existingEmailUser.role = "Employee";
      existingEmailUser.employeeId = employee.employeeId;
      existingEmailUser.employeeIdLable = employee.employeeId;
      existingEmailUser.isActive = true;

      await existingEmailUser.save();

      employee.loginEnabled = true;
      await employee.save();

      return {
        loginEnabled: true,
        isActive: true,
        employeeId: employee._id,
        employeeIdLable: employee.employeeId,
      };
    }

    existingEmailUser.name = employee.employeeName;
    existingEmailUser.email = email;
    existingEmailUser.role = "Employee";
    existingEmailUser.employeeId = employee._id;
    existingEmailUser.employeeIdLable = employee.employeeId;
    existingEmailUser.isActive = true;

    await existingEmailUser.save();

    employee.loginEnabled = true;
    await employee.save();

    return {
      loginEnabled: true,
      isActive: true,
      employeeId: employee._id,
      employeeIdLable: employee.employeeId,
    };
  }

  const user = await User.create({
    name: employee.employeeName,
    email,
    password: "123456",
    role: "Employee",
    isActive: true,
    employeeId: employee._id,
    employeeIdLable: employee.employeeId,
  });

  employee.loginEnabled = true;
  await employee.save();

  return {
    loginEnabled: true,
    isActive: true,
    employeeId: employee._id,
    employeeIdLable: employee.employeeId,
    userId: user._id,
  };
};

module.exports = {
  toggleEmployeeLogin,
};