const EmployeePermission = require("../models/rolePermission.model");
const Employee = require("../models/employee.model");
const Module = require("../models/sidebar.model");
const User = require("../models/user.model");
// ============================================================
// CREATE / UPDATE EMPLOYEE PERMISSIONS
// ============================================================
const upsertEmployeePermissions = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { permissions } = req.body;

    // --------------------------------------------------------
    // Validate employeeId
    // --------------------------------------------------------
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // --------------------------------------------------------
    // Validate permissions
    // --------------------------------------------------------
    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: "Permissions must be an array",
      });
    }

    // --------------------------------------------------------
    // Check employee exists
    // --------------------------------------------------------
    const employee = await Employee.findById(employeeId).select(
      "_id employeeId employeeName",
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // --------------------------------------------------------
    // Prevent duplicate modules
    // --------------------------------------------------------
    const moduleIds = permissions.map((permission) =>
      permission.moduleId?.toString(),
    );

    const uniqueModuleIds = new Set(moduleIds);

    if (moduleIds.length !== uniqueModuleIds.size) {
      return res.status(400).json({
        success: false,
        message: "Duplicate module permissions are not allowed",
      });
    }

    // --------------------------------------------------------
    // Get all requested modules
    // --------------------------------------------------------
    const modules = await Module.find({
      _id: { $in: moduleIds },
      isActive: true,
    }).lean();

    // --------------------------------------------------------
    // Check all module IDs exist
    // --------------------------------------------------------
    if (modules.length !== moduleIds.length) {
      const existingModuleIds = new Set(
        modules.map((module) => module._id.toString()),
      );

      const invalidModuleIds = moduleIds.filter(
        (id) => !existingModuleIds.has(id),
      );

      return res.status(400).json({
        success: false,
        message: "One or more modules are invalid or inactive",
        invalidModuleIds,
      });
    }

    // --------------------------------------------------------
    // Create module lookup
    // --------------------------------------------------------
    const moduleMap = new Map(
      modules.map((module) => [module._id.toString(), module]),
    );

    // --------------------------------------------------------
    // Validate and normalize permissions
    // --------------------------------------------------------
    const normalizedPermissions = permissions.map((permission) => {
      const moduleIds = permissions.map((permission) => {
        return permission.moduleId?.toString();
      });

      if (moduleIds.some((id) => !id)) {
        return res.status(400).json({
          success: false,
          message: "Every permission must contain a moduleId",
        });
      }
      const uniqueModuleIds = new Set(moduleIds);

      if (moduleIds.length !== uniqueModuleIds.size) {
        return res.status(400).json({
          success: false,
          message: "Duplicate module permissions are not allowed",
        });
      }

      const module = moduleMap.get(permission.moduleId.toString());

      const requestedActions = permission.actions || {};

      // Only allow actions supported by the Module
      const actions = {
        view: module.actions?.view === true && requestedActions.view === true,

        add: module.actions?.add === true && requestedActions.add === true,

        edit: module.actions?.edit === true && requestedActions.edit === true,

        delete:
          module.actions?.delete === true && requestedActions.delete === true,

        singleView:
          module.actions?.singleView === true &&
          requestedActions.singleView === true,
      };

      return {
        moduleId: module._id,
        actions,
      };
    });

    // --------------------------------------------------------
    // Update / Create permission document
    // --------------------------------------------------------
    const permission = await EmployeePermission.findOneAndUpdate(
      { employeeId },
      {
        $set: {
          permissions: normalizedPermissions,
          updatedBy: req.user?._id || null,
        },
        $setOnInsert: {
          employeeId,
          createdBy: req.user?._id || null,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    )
      .populate({
        path: "employeeId",
        select: "employeeId employeeName department designation",
      })
      .populate({
        path: "permissions.moduleId",
        select: "key name path moduleType actions isActive sortOrder",
      });

    return res.status(200).json({
      success: true,
      message: "Employee permissions saved successfully",
      data: permission,
    });
  } catch (error) {
    console.error("Upsert Employee Permissions Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save employee permissions",
      error: error.message,
    });
  }
};

// ============================================================
// GET EMPLOYEE PERMISSIONS
// ============================================================
const getEmployeePermissions = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const employee = await Employee.findById(employeeId).select(
      "_id employeeId employeeName department designation",
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const permission = await EmployeePermission.findOne({
      employeeId,
      isActive: true,
    })
      .populate({
        path: "employeeId",
        select: "employeeId employeeName department designation",
      })
      .populate({
        path: "permissions.moduleId",
        select: "key name path moduleType actions isActive sortOrder",
      });

    // --------------------------------------------------------
    // Employee exists but permission document doesn't exist
    // --------------------------------------------------------
    if (!permission) {
      return res.status(200).json({
        success: true,
        message: "No permissions configured for this employee",
        data: {
          employee,
          permissions: [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Employee permissions fetched successfully",
      data: permission,
    });
  } catch (error) {
    console.error("Get Employee Permissions Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee permissions",
      error: error.message,
    });
  }
};

// ============================================================
// GET MY PERMISSIONS
// ============================================================
const getMyPermissions = async (req, res) => {
  try {
    const userId = req.user._id;

    // --------------------------------------------------------
    // Get logged-in user
    // --------------------------------------------------------
    const user = await User.findById(userId).select(
      "_id name email role employeeId isActive",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // --------------------------------------------------------
    // Admin gets full access
    // --------------------------------------------------------
    const userRole = String(user.role || "")
      .trim()
      .toLowerCase();

    if (userRole === "admin") {
      return res.status(200).json({
        success: true,
        data: {
          isAdmin: true,
          permissions: [],
        },
      });
    }

    // --------------------------------------------------------
    // Employee validation
    // --------------------------------------------------------
    if (userRole !== "employee") {
      return res.status(403).json({
        success: false,
        message: "User is not an employee",
        role: user.role,
      });
    }

    // --------------------------------------------------------
    // Employee ID is required on User
    // --------------------------------------------------------
    if (!user.employeeId) {
      return res.status(404).json({
        success: false,
        message: "Employee ID is not linked with this user",
      });
    }

    // --------------------------------------------------------
    // Find Employee using User.employeeId
    // --------------------------------------------------------
    const employee = await Employee.findById(user.employeeId).select(
      "_id employeeId employeeName department designation role",
    );
    // const employee = await Employee.findOne({
    //   employeeId: user.employeeId,
    // }).select("_id employeeId employeeName department designation role");
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee record not found",
        employeeId: user.employeeId,
      });
    }

    // --------------------------------------------------------
    // Find permissions using Employee._id
    // --------------------------------------------------------
    const permission = await EmployeePermission.findOne({
      employeeId: employee._id,
      isActive: true,
    })
      .populate({
        path: "permissions.moduleId",
        select: "key name path moduleType actions isActive sortOrder",
      })
      .lean();

    // --------------------------------------------------------
    // No permissions configured
    // --------------------------------------------------------
    if (!permission) {
      return res.status(200).json({
        success: true,
        data: {
          isAdmin: false,
          employee: {
            _id: employee._id,
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            department: employee.department,
            designation: employee.designation,
          },
          permissions: [],
        },
      });
    }

    // --------------------------------------------------------
    // Return permissions
    // --------------------------------------------------------
    return res.status(200).json({
      success: true,
      data: {
        isAdmin: false,
        employee: {
          _id: employee._id,
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          department: employee.department,
          designation: employee.designation,
        },
        permissions: permission.permissions,
      },
    });
  } catch (error) {
    console.error("getMyPermissions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get permissions",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE / RESET EMPLOYEE PERMISSIONS
// ============================================================
const deleteEmployeePermissions = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const permission = await EmployeePermission.findOneAndUpdate(
      { employeeId },
      {
        $set: {
          permissions: [],
          updatedBy: req.user?._id || null,
        },
      },
      {
        new: true,
      },
    );

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Employee permissions reset successfully",
      data: permission,
    });
  } catch (error) {
    console.error("Delete Employee Permissions Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reset employee permissions",
      error: error.message,
    });
  }
};

module.exports = {
  upsertEmployeePermissions,
  getEmployeePermissions,
  getMyPermissions,
  deleteEmployeePermissions,
};