// controllers/bankTransactionController.js
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const xlsx = require("xlsx");
const mongoose = require("mongoose");
const BankTransaction = require("../models/bankTranscation.model");
const Client = require("../models/client.model");
const ClientRentHistory = require("../models/clientRentHistory.model");
const calculateRentHistory = require("../utils/calculateRentHistory");
// ===================== HELPER FUNCTIONS =====================
function findColumn(headers, possibleNames) {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  for (const name of possibleNames) {
    const index = lowerHeaders.findIndex((h) => h.includes(name.toLowerCase().trim()));
    if (index !== -1) return headers[index];
  }
  return null;
}

const excelSerialDateToJSDate = (serial) => {
  if (typeof serial !== "number") return serial;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  return new Date(utc_value * 1000);
};

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value === "number" && value > 1000 && value < 60000) {
    return excelSerialDateToJSDate(value);
  }
  if (typeof value === "string") {
    value = value.trim();
    let match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (match) return new Date(`${match[3]}-${match[2]}-${match[1]}`);
    match = value.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (match) return new Date(value);
    const nativeDate = new Date(value);
    if (!isNaN(nativeDate)) return nativeDate;
  }
  return null;
};

const parseNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    value = value.trim().replace(/,/g, "").replace(/\s/g, "");
    if (value === "" || value === "-") return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// ===================== MULTER CONFIGURATION =====================
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV and Excel files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  // limits mat do agar Multer side se size limit nahi chahiye
});
// Export multer upload middleware
exports.upload = upload;
// ===================== UPLOAD BANK STATEMENT =====================
exports.uploadBankStatement = async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV or Excel file",
      });
    }

    filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    let workbook;
    if (fileExtension === ".csv") {
      const csvData = fs.readFileSync(filePath, "utf8");
      workbook = xlsx.read(csvData, { type: "string" });
    } else {
      workbook = xlsx.readFile(filePath);
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    if (!rawData || rawData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "File is empty or has no valid data",
      });
    }

    const headers = Object.keys(rawData[0]);
    const columnMap = {
      date: findColumn(headers, ["date", "transaction date", "tran date", "value date"]),
      narration: findColumn(headers, ["narration", "description", "particulars", "details"]),
      chqNo: findColumn(headers, ["chq no", "cheque no", "ref no", "reference no", "chq.no"]),
      withdrawal: findColumn(headers, ["withdrawal", "withdraw", "debit", "dr", "payment", "amt out"]),
      deposit: findColumn(headers, ["deposit", "credit", "cr", "receipt", "amount in", "amt in"]),
      valueDate: findColumn(headers, ["value date", "settlement date", "effective date"]),
    };

    if (!columnMap.date || !columnMap.narration) {
      return res.status(400).json({
        success: false,
        message: "Could not find required columns: Date and Narration/Description",
        availableHeaders: headers,
      });
    }

    const transactions = [];
    const skippedRows = [];
    const rowErrors = [];

    rawData.forEach((row, index) => {
      try {
        const date = parseDate(row[columnMap.date]);
        if (!date) {
          rowErrors.push({
            row: index + 2,
            error: `Invalid date format: ${row[columnMap.date]}`,
          });
          return;
        }

        const withdrawal = parseNumber(row[columnMap.withdrawal] || 0);
        const deposit = parseNumber(row[columnMap.deposit] || 0);

        if (withdrawal === 0 && deposit === 0) {
          skippedRows.push(index + 2);
          return;
        }

        const valueDate = columnMap.valueDate ? parseDate(row[columnMap.valueDate]) : null;

        transactions.push({
          date,
          narration: String(row[columnMap.narration] || "").trim(),
          chqNo: columnMap.chqNo ? String(row[columnMap.chqNo] || "").trim() : "",
          withdrawal,
          deposit,
          valueDate,
          balance: 0,
          source: req.body.source || "upload",
          userId: req.user?._id || null,
          metadata: {
            fileName: req.file.originalname,
            uploadDate: new Date(),
            originalRow: JSON.stringify(row),
          },
        });
      } catch (error) {
        rowErrors.push({
          row: index + 2,
          error: error.message,
        });
      }
    });

    if (transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid transactions found in file",
        errors: rowErrors.slice(0, 10),
      });
    }

    // Duplicate check
    const existingTxns = await BankTransaction.find({
      $or: transactions.map((t) => ({
        date: t.date,
        narration: t.narration,
        withdrawal: t.withdrawal,
        deposit: t.deposit,
      })),
    });

    const existingKeys = new Set();
    existingTxns.forEach((doc) => {
      const key = `${doc.date.toISOString()}-${doc.narration}-${doc.withdrawal}-${doc.deposit}`;
      existingKeys.add(key);
    });

    const uniqueTransactions = [];
    const duplicateCount = { total: 0, rows: [] };

    transactions.forEach((t, index) => {
      const key = `${t.date.toISOString()}-${t.narration}-${t.withdrawal}-${t.deposit}`;
      if (existingKeys.has(key)) {
        duplicateCount.total++;
        duplicateCount.rows.push(index + 2);
      } else {
        uniqueTransactions.push(t);
      }
    });

    let importedCount = 0;
    let failedCount = 0;
    let insertedDocs = [];
    let writeErrors = [];

    if (uniqueTransactions.length > 0) {
      try {
        const result = await BankTransaction.insertMany(uniqueTransactions, {
          ordered: false,
        });
        importedCount = result.length;
        insertedDocs = result;
      } catch (error) {
        if (error.writeErrors) {
          importedCount = error.insertedDocs?.length || 0;
          failedCount = error.writeErrors.length;
          writeErrors = error.writeErrors;
        } else {
          throw error;
        }
      }
    }

    const totalRows = rawData.length;
    const skippedCount = skippedRows.length + duplicateCount.total;
    const failedRows = rowErrors.map((e) => e.row).concat(
      writeErrors?.map((e) => e.index + 2) || []
    );

    res.status(200).json({
      success: true,
      message: "Bank statement imported successfully",
      summary: {
        totalRows,
        imported: importedCount,
        skipped: skippedCount,
        failed: failedCount,
        duplicates: duplicateCount.total,
      },
      details: {
        duplicateRows: duplicateCount.rows.slice(0, 20),
        skippedRows: skippedRows.slice(0, 20),
        failedRows: failedRows.slice(0, 20),
        errors: rowErrors.slice(0, 10),
      },
      sample: insertedDocs.slice(0, 5),
    });
  } catch (error) {
    console.error("Import Error:", error);
    res.status(500).json({
      success: false,
      message: "Import failed",
      error: error.message,
    });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};





// ===================== GET ALL TRANSACTIONS =====================
exports.getAllTransactions = async (req, res) => {
  try {
    // ================= Pagination =================
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    // ================= Base Query =================
    const query = {};

    // ================= Global Search =================
    if (req.query.search?.trim()) {
      const regex = new RegExp(req.query.search.trim(), "i");

      query.$or = [{ narration: regex }, { chqNo: regex }, { source: regex }];
    }

    // ================= Transaction Date =================
    if (req.query.fromDate || req.query.toDate) {
      query.date = {};

      if (req.query.fromDate) {
        query.date.$gte = new Date(req.query.fromDate);
      }

      if (req.query.toDate) {
        const end = new Date(req.query.toDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    // ================= Value Date =================
    if (req.query.valueFromDate || req.query.valueToDate) {
      query.valueDate = {};

      if (req.query.valueFromDate) {
        query.valueDate.$gte = new Date(req.query.valueFromDate);
      }

      if (req.query.valueToDate) {
        const end = new Date(req.query.valueToDate);
        end.setHours(23, 59, 59, 999);
        query.valueDate.$lte = end;
      }
    }

    // ================= Source =================
    if (req.query.source) {
      query.source = req.query.source;
    }

    // ================= Uploaded By =================
    if (req.query.userId) {
      query.userId = req.query.userId;
    }

    // ================= Cheque / Ref No =================
    if (req.query.chqNo) {
      query.chqNo = {
        $regex: req.query.chqNo,
        $options: "i",
      };
    }

    // ================= Narration =================
    if (req.query.narration) {
      query.narration = {
        $regex: req.query.narration,
        $options: "i",
      };
    }

    // ================= Amount Filter =================
    if (req.query.minAmount || req.query.maxAmount) {
      const min = Number(req.query.minAmount || 0);
      const max = Number(req.query.maxAmount || Number.MAX_SAFE_INTEGER);

      query.$and = [
        {
          $or: [
            {
              withdrawal: {
                $gte: min,
                $lte: max,
              },
            },
            {
              deposit: {
                $gte: min,
                $lte: max,
              },
            },
          ],
        },
      ];
    }

    // ================= Transaction Type =================
    // ================= Transaction Type =================
    if (req.query.transactionType === "deposit") {
      query.deposit = { $gt: 0 };
    }

    if (req.query.transactionType === "withdrawal") {
      query.withdrawal = { $gt: 0 };
    }

    // ================= Count =================
    const totalRecords = await BankTransaction.countDocuments(query);

    // ================= Fetch =================
    const transactions = await BankTransaction.find(query)
      .populate("userId", "fullName")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      hasNextPage: page < Math.ceil(totalRecords / limit),
      hasPrevPage: page > 1,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    console.error("Get Transactions Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
      error: error.message,
    });
  }
};





// ===================== GET SINGLE TRANSACTION =====================
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID",
      });
    }

    const transaction = await BankTransaction.findById(id).lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Get Transaction Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transaction",
      error: error.message,
    });
  }
};

// ===================== UPDATE TRANSACTION =====================
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID",
      });
    }

    delete updates._id;
    delete updates.__v;
    delete updates.metadata;

    const transaction = await BankTransaction.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Transaction updated successfully",
      data: transaction,
    });
  } catch (error) {
    console.error("Update Transaction Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update transaction",
      error: error.message,
    });
  }
};

// ===================== DELETE TRANSACTION =====================
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID",
      });
    }

    const transaction = await BankTransaction.findByIdAndDelete(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    console.error("Delete Transaction Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete transaction",
      error: error.message,
    });
  }
};

// ===================== DELETE MULTIPLE TRANSACTIONS =====================
exports.deleteMultipleTransactions = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of transaction IDs",
      });
    }

    const invalidIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction IDs provided",
        invalidIds,
      });
    }

    const result = await BankTransaction.deleteMany({
      _id: { $in: ids },
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} transactions deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Delete Multiple Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete transactions",
      error: error.message,
    });
  }
};

// ===================== GET SUMMARY STATISTICS =====================
exports.getSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const match = {};
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }

    const summary = await BankTransaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalDeposits: { $sum: "$deposit" },
          totalWithdrawals: { $sum: "$withdrawal" },
          transactionCount: { $sum: 1 },
          uniqueDays: { $addToSet: { $dateToString: { format: "%Y-%m-%d", date: "$date" } } },
        },
      },
      {
        $project: {
          _id: 0,
          totalDeposits: 1,
          totalWithdrawals: 1,
          totalTransactions: "$transactionCount",
          netBalance: { $subtract: ["$totalDeposits", "$totalWithdrawals"] },
          averageDeposit: { $divide: ["$totalDeposits", "$transactionCount"] },
          averageWithdrawal: { $divide: ["$totalWithdrawals", "$transactionCount"] },
          dayCount: { $size: "$uniqueDays" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: summary[0] || {
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalTransactions: 0,
        netBalance: 0,
        averageDeposit: 0,
        averageWithdrawal: 0,
        dayCount: 0,
      },
    });
  } catch (error) {
    console.error("Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get summary",
      error: error.message,
    });
  }
};

exports.getClientsByPropertyId = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const clients = await Client.aggregate([
      {
        $match: {
          propertyId: new mongoose.Types.ObjectId(propertyId),
          isBookingCancelled: false,
        },
      },

      {
        $lookup: {
          from: "beds",
          localField: "bedId",
          foreignField: "_id",
          as: "bed",
        },
      },
      {
        $unwind: "$bed",
      },

      {
        $lookup: {
          from: "clientrenthistories",
          let: { clientId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$clientId", "$$clientId"],
                },
              },
            },
            {
              $sort: {
                year: -1,
                month: -1,
                createdAt: -1,
              },
            },
            {
              $limit: 1,
            },
          ],
          as: "rentHistory",
        },
      },

      {
        $unwind: {
          path: "$rentHistory",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          fullName: 1,
          propertyId: 1,
          stayType: 1,

          bedId: {
            _id: "$bed._id",
            roomNo: "$bed.roomNo",
            bedNo: "$bed.bedNo",
          },

          month: {
            $ifNull: ["$rentHistory.month", null],
          },
          
          monthName: {
            $ifNull: ["$rentHistory.monthName", null],
          },

          year: {
            $ifNull: ["$rentHistory.year", null],
          },

          paymentStatus: {
            $ifNull: ["$rentHistory.paymentStatus", null],
          },

          currentDue: {
            $ifNull: ["$rentHistory.currentDue", 0],
          },

          totalReceived: {
            $ifNull: ["$rentHistory.totalReceived", 0],
          },
        },
      },

      {
        $sort: {
          fullName: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: clients,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// exports.updateClientRentHistoryReceived = async (req, res) => {
//   try {
//     const {
//       propertyId,
//       clientId,
//       bedId,
//       month,
//       year,
//       amount,
//       // transactionId,
//       // valueDate,
//     } = req.body;

//     const history = await ClientRentHistory.findOne({
//       propertyId,
//       clientId,
//       bedId,
//       month,
//       year,
//     });

//     if (!history) {
//       return res.status(404).json({
//         success: false,
//         message: "Rent history not found",
//       });
//     }

//     const receivedAmount = Number(amount || 0);

//     const cumulativeReceived =
//       Number(history.totalReceived || 0) + receivedAmount;

//     const calculation = calculateRentHistory({
//       monthlyRent: history.monthlyRent,
//       depositAmount: history.depositAmount,
//       daysCount: history.daysCount,
//       previousDue: history.previousDue,

//       ebAmt: history.ebAmt,
//       flatEB: history.flatEB,
//       adjEB: history.adjEB,
//       adjAmt: history.adjAmt,

//       processingFees: history.processingFees,
//       parkingCharges: history.parkingCharges,

//       processingFeesReceived: history.processingFeesReceived,
//       depositAmountReceived: history.depositAmountReceived,

//       // 👇 important
//       rentReceived: cumulativeReceived,
//     });

//     Object.assign(history, calculation);

//     history.totalReceived = cumulativeReceived;

//     history.totalReceivedHistory.push({
//       amount: receivedAmount,
//       // valueDate: valueDate || new Date(),
//       date: new Date(),
//     });

//     await history.save();
//     return res.status(200).json({
//       success: true,
//       message: "Received amount added successfully",
//       data: history,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


exports.updateClientRentHistoryReceived = async (req, res) => {
  try {
    const {
      propertyId,
      clientId,
      bedId,
      month,
      year,
      amount,
      transactionId,
    } = req.body;
    // ===============================
    // Check Transaction
    // ===============================
    const transaction = await BankTransaction.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Bank transaction not found",
      });
    }
    if (transaction.isMapped) {
      return res.status(400).json({
        success: false,
        message: "This transaction is already mapped.",
      });
    }
    // ===============================
    // Find Rent History
    // ===============================
    const history = await ClientRentHistory.findOne({
      propertyId,
      clientId,
      bedId,
      month,
      year,
    });

    if (!history) {
      return res.status(404).json({
        success: false,
        message: "Rent history not found",
      });
    }

    const receivedAmount = Number(amount || 0);

    const cumulativeReceived =
      Number(history.totalReceived || 0) + receivedAmount;

const actualLastDay = new Date(
  history.year,
  history.month,
  0
).getDate();

const rentDivider =
  actualLastDay === 31 ? 30 : actualLastDay;
    // ===============================
    // Recalculate
    // ===============================
    const calculation = calculateRentHistory({
      monthlyRent: history.monthlyRent,
      depositAmount: history.depositAmount,
      daysCount: history.daysCount,
      previousDue: history.previousDue,
      ebAmt: history.ebAmt,
      flatEB: history.flatEB,
      adjEB: history.adjEB,
      adjAmt: history.adjAmt,
      processingFees: history.processingFees,
      parkingCharges: history.parkingCharges,
      processingFeesReceived:
        history.processingFeesReceived,
      depositAmountReceived:
        history.depositAmountReceived,
      rentReceived: cumulativeReceived,
      rentDivider
    });
    Object.assign(history, calculation);
    history.totalReceived = cumulativeReceived;
    history.totalReceivedHistory.push({
      amount: receivedAmount,
      transactionId: transaction._id,
      valueDate: transaction.valueDate,
      date: new Date(),
    });
    await history.save();
    // ===============================
    // Mark Transaction Used
    // ===============================
    transaction.isMapped = true;
    transaction.mappedAt = new Date();
    transaction.clientId = clientId;
    transaction.propertyId = propertyId;
    transaction.bedId = bedId;
    transaction.rentHistoryId = history._id;
    await transaction.save();
    return res.status(200).json({
      success: true,
      message: "Received amount added successfully.",
      data: history,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getTransactionByNarration = async (req, res) => {
  try {
    const { narration } = req.params;
    if (!narration?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Narration is required",
      });
    }
    const transaction = await BankTransaction.findOne({
      narration: narration.trim(),
    }).lean();
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }
    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Get Transaction By Narration Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transaction",
      error: error.message,
    });
  }
};