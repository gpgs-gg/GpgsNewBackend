const mongoose = require("mongoose");

const permissionActionSchema = new mongoose.Schema(
  {
    view: {
      type: Boolean,
      default: false,
    },

    add: {
      type: Boolean,
      default: false,
    },

    edit: {
      type: Boolean,
      default: false,
    },

    delete: {
      type: Boolean,
      default: false,
    },

    singleView: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  },
);

const employeePermissionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      unique: true,
      index: true,
    },

    permissions: [
      {
        moduleId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Module",
          required: true,
        },

        actions: {
          type: permissionActionSchema,
          default: () => ({}),
        },
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate module permissions for the same employee
employeePermissionSchema.path("permissions").validate(function (permissions) {
  const moduleIds = permissions.map((permission) =>
    permission.moduleId.toString(),
  );

  return moduleIds.length === new Set(moduleIds).size;
}, "Duplicate module permissions are not allowed.");

module.exports = mongoose.model("EmployeePermission", employeePermissionSchema);