const Module = require("../models/sidebar.model");

// ===============================
// Create Module
// ===============================
exports.createModule = async (req, res) => {
  try {
    const { key, name, path, moduleType, actions, isActive, sortOrder } =
      req.body;

    // Required validation
    if (!key || !name || !path) {
      return res.status(400).json({
        success: false,
        message: "Key, name and path are required",
      });
    }

    // Check duplicate key
    const existingModule = await Module.findOne({
      key: key.trim(),
    });

    if (existingModule) {
      return res.status(409).json({
        success: false,
        message: "Module with this key already exists",
      });
    }

    const moduleData = await Module.create({
      key: key.trim(),
      name: name.trim(),
      path: path.trim(),
      moduleType: moduleType || "MENU",
      actions: {
        view: actions?.view ?? true,
        add: actions?.add ?? false,
        edit: actions?.edit ?? false,
        delete: actions?.delete ?? false,
        singleView: actions?.singleView ?? false,
      },
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
    });

    return res.status(201).json({
      success: true,
      message: "Module created successfully",
      data: moduleData,
    });
  } catch (error) {
    console.error("Create Module Error:", error);

    // MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Module key already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create module",
      error: error.message,
    });
  }
};

// ===============================
// Get All Modules
// ===============================
exports.getAllModules = async (req, res) => {
  try {
    const { search = "", moduleType, isActive } = req.query;

    const filter = {};

    // Search
    if (search.trim()) {
      filter.$or = [
        {
          key: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          name: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          path: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    // Module type filter
    if (moduleType) {
      filter.moduleType = moduleType;
    }

    // Active filter
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const modules = await Module.find(filter).sort({
      sortOrder: 1,
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: modules.length,
      data: modules,
    });
  } catch (error) {
    console.error("Get Modules Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch modules",
      error: error.message,
    });
  }
};

// ===============================
// Get Single Module
// ===============================
exports.getSingleModule = async (req, res) => {
  try {
    const { id } = req.params;

    const moduleData = await Module.findById(id);

    if (!moduleData) {
      return res.status(404).json({
        success: false,
        message: "Module not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: moduleData,
    });
  } catch (error) {
    console.error("Get Single Module Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch module",
      error: error.message,
    });
  }
};

// ===============================
// Update Module
// ===============================
exports.updateModule = async (req, res) => {
  try {
    const { id } = req.params;

    const { key, name, path, moduleType, actions, isActive, sortOrder } =
      req.body;

    const existingModule = await Module.findById(id);

    if (!existingModule) {
      return res.status(404).json({
        success: false,
        message: "Module not found",
      });
    }

    // Check duplicate key when key is changed
    if (key && key.trim() !== existingModule.key) {
      const duplicateModule = await Module.findOne({
        key: key.trim(),
        _id: { $ne: id },
      });

      if (duplicateModule) {
        return res.status(409).json({
          success: false,
          message: "Module with this key already exists",
        });
      }

      existingModule.key = key.trim();
    }

    if (name !== undefined) {
      existingModule.name = name.trim();
    }

    if (path !== undefined) {
      existingModule.path = path.trim();
    }

    if (moduleType !== undefined) {
      existingModule.moduleType = moduleType;
    }

    if (actions !== undefined) {
      existingModule.actions = {
        view: actions.view ?? existingModule.actions.view,
        add: actions.add ?? existingModule.actions.add,
        edit: actions.edit ?? existingModule.actions.edit,
        delete: actions.delete ?? existingModule.actions.delete,
        singleView: actions.singleView ?? existingModule.actions.singleView,
      };
    }

    if (isActive !== undefined) {
      existingModule.isActive = isActive;
    }

    if (sortOrder !== undefined) {
      existingModule.sortOrder = sortOrder;
    }

    await existingModule.save();

    return res.status(200).json({
      success: true,
      message: "Module updated successfully",
      data: existingModule,
    });
  } catch (error) {
    console.error("Update Module Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Module key already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update module",
      error: error.message,
    });
  }
};

// ===============================
// Delete Module
// ===============================
exports.deleteModule = async (req, res) => {
  try {
    const { id } = req.params;

    const moduleData = await Module.findById(id);

    if (!moduleData) {
      return res.status(404).json({
        success: false,
        message: "Module not found",
      });
    }

    await Module.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Module deleted successfully",
    });
  } catch (error) {
    console.error("Delete Module Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete module",
      error: error.message,
    });
  }
};

// ===============================
// Toggle Module Status
// ===============================
exports.toggleModuleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const moduleData = await Module.findById(id);

    if (!moduleData) {
      return res.status(404).json({
        success: false,
        message: "Module not found",
      });
    }

    moduleData.isActive = !moduleData.isActive;

    await moduleData.save();

    return res.status(200).json({
      success: true,
      message: `Module ${
        moduleData.isActive ? "activated" : "deactivated"
      } successfully`,
      data: moduleData,
    });
  } catch (error) {
    console.error("Toggle Module Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update module status",
      error: error.message,
    });
  }
};