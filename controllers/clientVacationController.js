const ClientVacationHistory = require('../models/clientVacationHistory.model');
const Client = require('../models/client.model');

// ✅ Get vacation for a specific client + month/year
exports.getVacationByMonth = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required query parameters',
      });
    }

    const vacation = await ClientVacationHistory.findOne({
      clientId,
      month: parseInt(month),
      year: parseInt(year),
    });

    if (!vacation) {
      return res.status(404).json({
        success: false,
        message: 'No vacation record found for this month/year',
      });
    }

    res.status(200).json({
      success: true,
      data: vacation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Get all vacation history for a client
exports.getAllVacationsByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { sortBy = 'year', order = 'desc' } = req.query;

    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const sortOrder = order === 'desc' ? -1 : 1;
    const vacations = await ClientVacationHistory.find({ clientId })
      .sort({ [sortBy]: sortOrder, month: sortOrder });

    res.status(200).json({
      success: true,
      count: vacations.length,
      data: vacations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Get all vacation records (admin view)
exports.getAllVacations = async (req, res) => {
  try {
    const { month, year, clientId } = req.query;
    let filter = {};

    if (month && year) {
      filter.month = parseInt(month);
      filter.year = parseInt(year);
    }

    if (clientId) {
      filter.clientId = clientId;
    }

    const vacations = await ClientVacationHistory.find(filter)
      .populate('clientId', 'name phone flatNo') // Populate client details
      .sort({ year: -1, month: -1 });

    res.status(200).json({
      success: true,
      count: vacations.length,
      data: vacations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Create new vacation record
exports.createVacation = async (req, res) => {
  try {
    const {
      clientId,
      month,
      year,
      vacationStartDate1,
      vacationLastDate1,
      vacationStartDate2,
      vacationLastDate2,
    } = req.body;

    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    // Check if record already exists for this month/year
    const existingVacation = await ClientVacationHistory.findOne({
      clientId,
      month,
      year,
    });

    if (existingVacation) {
      return res.status(400).json({
        success: false,
        message: `Vacation record already exists for ${month}/${year}. Use update endpoint instead.`,
      });
    }

    const vacation = new ClientVacationHistory({
      clientId,
      month,
      year,
      vacationStartDate1: vacationStartDate1 || null,
      vacationLastDate1: vacationLastDate1 || null,
      vacationStartDate2: vacationStartDate2 || null,
      vacationLastDate2: vacationLastDate2 || null,
    });

    await vacation.save();

    res.status(201).json({
      success: true,
      message: 'Vacation record created successfully',
      data: vacation,
    });
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Vacation record already exists for this client/month/year',
      });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Update existing vacation record
exports.updateVacation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      vacationStartDate1,
      vacationLastDate1,
      vacationStartDate2,
      vacationLastDate2,
    } = req.body;

    // Find and update
    const vacation = await ClientVacationHistory.findById(id);
    if (!vacation) {
      return res.status(404).json({
        success: false,
        message: 'Vacation record not found',
      });
    }

    // Update only provided fields
    if (vacationStartDate1 !== undefined) vacation.vacationStartDate1 = vacationStartDate1 || null;
    if (vacationLastDate1 !== undefined) vacation.vacationLastDate1 = vacationLastDate1 || null;
    if (vacationStartDate2 !== undefined) vacation.vacationStartDate2 = vacationStartDate2 || null;
    if (vacationLastDate2 !== undefined) vacation.vacationLastDate2 = vacationLastDate2 || null;

    await vacation.save();

    res.status(200).json({
      success: true,
      message: 'Vacation record updated successfully',
      data: vacation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Update or Create (Upsert) vacation record
exports.upsertVacation = async (req, res) => {
  try {
    const { clientId, month, year } = req.params;
    const {
      vacationStartDate1,
      vacationLastDate1,
      vacationStartDate2,
      vacationLastDate2,
    } = req.body;

    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found',
      });
    }

    const vacation = await ClientVacationHistory.findOneAndUpdate(
      {
        clientId,
        month: parseInt(month),
        year: parseInt(year),
      },
      {
        clientId,
        month: parseInt(month),
        year: parseInt(year),
        vacationStartDate1: vacationStartDate1 || null,
        vacationLastDate1: vacationLastDate1 || null,
        vacationStartDate2: vacationStartDate2 || null,
        vacationLastDate2: vacationLastDate2 || null,
      },
      {
        new: true, // Return updated document
        upsert: true, // Create if doesn't exist
        setDefaultsOnInsert: true,
      }
    );

    const action = vacation.createdAt === vacation.updatedAt ? 'created' : 'updated';

    res.status(200).json({
      success: true,
      message: `Vacation record ${action} successfully`,
      data: vacation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Delete vacation record
exports.deleteVacation = async (req, res) => {
  try {
    const { id } = req.params;

    const vacation = await ClientVacationHistory.findByIdAndDelete(id);
    if (!vacation) {
      return res.status(404).json({
        success: false,
        message: 'Vacation record not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Vacation record deleted successfully',
      data: vacation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Delete all vacation records for a client
exports.deleteAllVacationsByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const result = await ClientVacationHistory.deleteMany({ clientId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No vacation records found for this client',
      });
    }

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} vacation records deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Get current month's vacation (auto-detect)
exports.getCurrentMonthVacation = async (req, res) => {
  try {
    const { clientId } = req.params;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const vacation = await ClientVacationHistory.findOne({
      clientId,
      month,
      year,
    });

    if (!vacation) {
      return res.status(404).json({
        success: false,
        message: 'No vacation record found for current month',
        currentMonth: month,
        currentYear: year,
      });
    }

    res.status(200).json({
      success: true,
      currentMonth: month,
      currentYear: year,
      data: vacation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Get vacation for EB calculation (with client details)
exports.getVacationForEB = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required for EB calculation',
      });
    }

    const vacation = await ClientVacationHistory.findOne({
      clientId,
      month: parseInt(month),
      year: parseInt(year),
    });

    // Return even if null - EB calculation will handle it
    res.status(200).json({
      success: true,
      data: vacation || null,
      hasVacation: vacation ? true : false,
      message: vacation ? 'Vacation data found' : 'No vacation data for this month',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};