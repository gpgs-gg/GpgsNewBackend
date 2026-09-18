// controllers/bankTransactionController.js
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const xlsx = require("xlsx");
const mongoose = require("mongoose");
const Client = require("../models/client.model");
const calculateRentHistory = require("../utils/calculateRentHistory");
const ClientRentHistory = require("../models/clientRentHistory.model");
const {
  AC1Transaction,
  AC2Transaction,
  AC3Transaction,
  AC4Transaction,
  AC5Transaction,
} = require("../models/bankTranscation.model");
const OptionsData = require("../models/options.model");



function findColumn(headers, possibleNames) {
  const lowerHeaders = headers.map((h) =>
    String(h).toLowerCase().trim()
  );

  for (const name of possibleNames) {
    const index = lowerHeaders.findIndex(
      (h) => h === name.toLowerCase().trim()
    );
    if (index !== -1) return headers[index];
  }

  for (const name of possibleNames) {
    const index = lowerHeaders.findIndex(
      (h) => h.includes(name.toLowerCase().trim())
    );
    if (index !== -1) return headers[index];
  }

  return null;
}

const excelSerialDateToJSDate = (serial) => {
  if (typeof serial !== "number") return null;

  const excelEpoch = new Date(Date.UTC(1899, 11, 30));

  return new Date(
    excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000
  );
};

const parseDate = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  // Excel serial date
  if (typeof value === "number" && value > 1000 && value < 60000) {
    return excelSerialDateToJSDate(value);
  }

  if (typeof value !== "string") return null;

  value = value.trim();

  // DD/MM/YYYY or DD-MM-YYYY
  let match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date;
  }

  // DD/MM/YY or DD-MM-YY
  match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})$/);

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = 2000 + Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date;
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
// exports.uploadBankStatement = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "Please upload a CSV or Excel file"
//       });
//     }

//     const account = req.body.account?.toUpperCase();

//     const accountModels = {
//       AC1: AC1Transaction,
//       AC2: AC2Transaction,
//       AC3: AC3Transaction,
//       AC4: AC4Transaction,
//       AC5: AC5Transaction
//     };

//     const TransactionModel = accountModels[account];

//     if (!TransactionModel) {
//       return res.status(400).json({
//         success: false,
//         message: "Valid account is required. Use AC1, AC2, AC3, AC4 or AC5."
//       });
//     }

//     const fileExtension = path.extname(req.file.originalname).toLowerCase();
//     let workbook;

//     if (fileExtension === ".csv") {
//       const csvData = req.file.buffer.toString("utf8");
//       workbook = xlsx.read(csvData, { type: "string" });
//     } else {
//       workbook = xlsx.read(req.file.buffer, { type: "buffer" });
//     }

//     const sheetName = workbook.SheetNames[0];
//     const sheet = workbook.Sheets[sheetName];

//     const rawData = xlsx.utils.sheet_to_json(sheet, {
//       defval: "",
//       raw: false,
//       cellDates: true
//     });

//     if (!rawData || rawData.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "File is empty or has no valid data"
//       });
//     }

//     const headers = Object.keys(rawData[0]);

//     const columnMap = {
//       date: findColumn(headers, ["date", "transaction date", "tran date"]),
//       narration: findColumn(headers, ["narration", "description", "particulars", "details"]),
//       chqNo: findColumn(headers, ["chq no", "cheque no", "ref no", "reference no", "chq.no"]),
//       withdrawal: findColumn(headers, ["withdrawal", "withdraw", "debit", "dr", "payment", "amt out"]),
//       deposit: findColumn(headers, ["deposit", "credit", "cr", "receipt", "amount in", "amt in"]),
//       valueDate: findColumn(headers, ["value date", "settlement date", "effective date", "Value Dt"])
//     };

//     if (!columnMap.date || !columnMap.narration) {
//       return res.status(400).json({
//         success: false,
//         message: "Could not find required columns: Date and Narration/Description",
//         availableHeaders: headers
//       });
//     }

//     const transactions = [];
//     const skippedRows = [];
//     const rowErrors = [];

//     rawData.forEach((row, index) => {
//       try {
//         const date = parseDate(row[columnMap.date]);

//         if (!date) {
//           rowErrors.push({
//             row: index + 2,
//             error: `Invalid date format: ${row[columnMap.date]}`
//           });
//           return;
//         }

//         const withdrawal = parseNumber(row[columnMap.withdrawal] || 0);
//         const deposit = parseNumber(row[columnMap.deposit] || 0);

//         if (withdrawal === 0 && deposit === 0) {
//           skippedRows.push(index + 2);
//           return;
//         }

//         const valueDate = columnMap.valueDate
//           ? parseDate(row[columnMap.valueDate])
//           : null;

//         transactions.push({
//           date,
//           narration: String(row[columnMap.narration] || "").trim(),
//           chqNo: columnMap.chqNo
//             ? String(row[columnMap.chqNo] || "").trim()
//             : "",
//           withdrawal,
//           deposit,
//           valueDate,
//           balance: 0,
//           source: req.body.source || "upload",
//           userId: req.user?._id || null,
//           metadata: {
//             fileName: req.file.originalname,
//             uploadDate: new Date(),
//             originalRow: JSON.stringify(row)
//           }
//         });
//       } catch (error) {
//         rowErrors.push({
//           row: index + 2,
//           error: error.message
//         });
//       }
//     });

//     if (transactions.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No valid transactions found in file",
//         errors: rowErrors.slice(0, 10)
//       });
//     }

//     const existingTxns = await TransactionModel.find({
//       $or: transactions.map(t => ({
//         date: t.date,
//         narration: t.narration,
//         withdrawal: t.withdrawal,
//         deposit: t.deposit
//       }))
//     }).lean();

//     const existingKeys = new Set();

//     existingTxns.forEach(doc => {
//       const key = `${doc.date.toISOString()}-${doc.narration}-${doc.withdrawal}-${doc.deposit}`;
//       existingKeys.add(key);
//     });

//     const uniqueTransactions = [];
//     const duplicateCount = {
//       total: 0,
//       rows: []
//     };

//     transactions.forEach((t, index) => {
//       const key = `${t.date.toISOString()}-${t.narration}-${t.withdrawal}-${t.deposit}`;

//       if (existingKeys.has(key)) {
//         duplicateCount.total++;
//         duplicateCount.rows.push(index + 2);
//       } else {
//         uniqueTransactions.push(t);
//       }
//     });

//     let importedCount = 0;
//     let failedCount = 0;
//     let insertedDocs = [];
//     let writeErrors = [];

//     if (uniqueTransactions.length > 0) {
//       try {
//         const result = await TransactionModel.insertMany(
//           uniqueTransactions,
//           { ordered: false }
//         );

//         importedCount = result.length;
//         insertedDocs = result;
//       } catch (error) {
//         if (error.writeErrors) {
//           importedCount = error.insertedDocs?.length || 0;
//           failedCount = error.writeErrors.length;
//           writeErrors = error.writeErrors;
//         } else {
//           throw error;
//         }
//       }
//     }

//     const totalRows = rawData.length;

//     const skippedCount =
//       skippedRows.length + duplicateCount.total;

//     const failedRows =
//       rowErrors.map(e => e.row).concat(
//         writeErrors?.map(e => e.index + 2) || []
//       );

//     return res.status(200).json({
//       success: true,
//       message: `Bank statement imported successfully into ${account}`,
//       account,
//       collection: TransactionModel.collection.name,
//       summary: {
//         totalRows,
//         imported: importedCount,
//         skipped: skippedCount,
//         failed: failedCount,
//         duplicates: duplicateCount.total
//       },
//       details: {
//         duplicateRows: duplicateCount.rows.slice(0, 20),
//         skippedRows: skippedRows.slice(0, 20),
//         failedRows: failedRows.slice(0, 20),
//         errors: rowErrors.slice(0, 10)
//       },
//       sample: insertedDocs.slice(0, 5)
//     });

//   } catch (error) {
//     console.error("Import Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Import failed",
//       error: error.message
//     });
//   }
// };
exports.uploadBankStatement = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV or Excel file",
      });
    }

    const account = req.body.account?.toUpperCase();

    const accountModels = {
      AC1: AC1Transaction,
      AC2: AC2Transaction,
      AC3: AC3Transaction,
      AC4: AC4Transaction,
      AC5: AC5Transaction,
    };

    const TransactionModel = accountModels[account];

    if (!TransactionModel) {
      return res.status(400).json({
        success: false,
        message:
          "Valid account is required. Use AC1, AC2, AC3, AC4 or AC5.",
      });
    }

    // ================= FILE READ =================

    const fileExtension = path
      .extname(req.file.originalname)
      .toLowerCase();

    let workbook;

    if (fileExtension === ".csv") {
      const csvData = req.file.buffer.toString("utf8");

      workbook = xlsx.read(csvData, {
        type: "string",
      });
    } else {
      workbook = xlsx.read(req.file.buffer, {
        type: "buffer",
      });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawData = xlsx.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
      cellDates: true,
    });

    if (!rawData || rawData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "File is empty or has no valid data",
      });
    }

    // ================= COLUMN MAP =================

    const headers = Object.keys(rawData[0]);

    const columnMap = {
      date: findColumn(headers, [
        "date",
        "transaction date",
        "tran date",
      ]),

      narration: findColumn(headers, [
        "narration",
        "description",
        "particulars",
        "details",
      ]),

      chqNo: findColumn(headers, [
        "chq no",
        "cheque no",
        "ref no",
        "reference no",
        "chq.no",
      ]),

      withdrawal: findColumn(headers, [
        "withdrawal",
        "withdraw",
        "debit",
        "dr",
        "payment",
        "amt out",
      ]),

      deposit: findColumn(headers, [
        "deposit",
        "credit",
        "cr",
        "receipt",
        "amount in",
        "amt in",
      ]),

      valueDate: findColumn(headers, [
        "value date",
        "settlement date",
        "effective date",
        "Value Dt",
      ]),
    };

    if (!columnMap.date || !columnMap.narration) {
      return res.status(400).json({
        success: false,
        message:
          "Could not find required columns: Date and Narration/Description",
        availableHeaders: headers,
      });
    }

    // ================= PARSE TRANSACTIONS =================

    const transactions = [];
    const skippedRows = [];
    const rowErrors = [];

    rawData.forEach((row, index) => {
      try {
        const excelRow = index + 2;

        const date = parseDate(row[columnMap.date]);

        if (!date) {
          rowErrors.push({
            row: excelRow,
            error: `Invalid date format: ${row[columnMap.date]}`,
          });

          return;
        }

        const narration = String(
          row[columnMap.narration] || ""
        ).trim();

        const withdrawal = parseNumber(
          row[columnMap.withdrawal] || 0
        );

        const deposit = parseNumber(
          row[columnMap.deposit] || 0
        );

        if (withdrawal === 0 && deposit === 0) {
          skippedRows.push(excelRow);
          return;
        }

        const valueDate = columnMap.valueDate
          ? parseDate(row[columnMap.valueDate])
          : null;

        transactions.push({
          date,

          narration,

          chqNo: columnMap.chqNo
            ? String(row[columnMap.chqNo] || "").trim()
            : "",

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

    // =====================================================
    // DUPLICATE CHECK
    // Date + Narration + Value Date
    // =====================================================

    const makeTransactionKey = (transaction) => {
      const dateKey = transaction.date
        ? new Date(transaction.date).toISOString()
        : "";

      const valueDateKey = transaction.valueDate
        ? new Date(transaction.valueDate).toISOString()
        : "";

      const narrationKey = String(
        transaction.narration || ""
      )
        .trim()
        .toLowerCase();

      return `${dateKey}|${narrationKey}|${valueDateKey}`;
    };

    // ================= FIND EXISTING RECORDS =================

    const existingTxns = await TransactionModel.find({
      $or: transactions.map((t) => ({
        date: t.date,
        narration: t.narration,
        valueDate: t.valueDate,
      })),
    })
      .select("_id date narration valueDate")
      .lean();

    // ================= EXISTING KEYS =================

    const existingKeys = new Map();

    existingTxns.forEach((doc) => {
      const key = makeTransactionKey(doc);

      existingKeys.set(key, doc);
    });

    // ================= DUPLICATE PROCESS =================

    const uniqueTransactions = [];

    const duplicateDetails = [];

    transactions.forEach((transaction, index) => {
      const excelRow = index + 2;

      const key = makeTransactionKey(transaction);

      const existingTransaction = existingKeys.get(key);

      if (existingTransaction) {
        duplicateDetails.push({
          row: excelRow,

          reason: "Transaction already exists",

          matchedTransactionId:
            existingTransaction._id,

          date: transaction.date,

          narration: transaction.narration,

          valueDate: transaction.valueDate,
        });

        return;
      }

      // Same uploaded file madhye duplicate prevent
      existingKeys.set(key, {
        _id: null,
        date: transaction.date,
        narration: transaction.narration,
        valueDate: transaction.valueDate,
      });

      uniqueTransactions.push(transaction);
    });

    // ================= INSERT =================

    let importedCount = 0;
    let failedCount = 0;

    let insertedDocs = [];
    let writeErrors = [];

    if (uniqueTransactions.length > 0) {
      try {
        const result = await TransactionModel.insertMany(
          uniqueTransactions,
          {
            ordered: false,
          }
        );

        importedCount = result.length;
        insertedDocs = result;
      } catch (error) {
        if (error.writeErrors) {
          importedCount =
            error.insertedDocs?.length || 0;

          failedCount = error.writeErrors.length;

          writeErrors = error.writeErrors;
        } else {
          throw error;
        }
      }
    }

    // ================= SUMMARY =================

    const totalRows = rawData.length;

    const duplicateCount = duplicateDetails.length;

    const skippedCount =
      skippedRows.length + duplicateCount;

    const failedRows = rowErrors
      .map((e) => e.row)
      .concat(
        writeErrors?.map(
          (e) => e.index + 2
        ) || []
      );

    // ================= RESPONSE =================

    return res.status(200).json({
      success: true,

      message:
        duplicateCount > 0
          ? `Bank statement imported with ${duplicateCount} duplicate transaction(s) skipped`
          : `Bank statement imported successfully into ${account}`,

      account,

      collection: TransactionModel.collection.name,

      summary: {
        totalRows,

        imported: importedCount,

        skipped: skippedCount,

        failed: failedCount,

        duplicates: duplicateCount,
      },

      details: {
        duplicateRows: duplicateDetails,

        skippedRows: skippedRows.slice(0, 20),

        failedRows: failedRows.slice(0, 20),

        errors: rowErrors.slice(0, 10),
      },

      sample: insertedDocs.slice(0, 5),
    });
  } catch (error) {
    console.error("Import Error:", error);

    return res.status(500).json({
      success: false,
      message: "Import failed",
      error: error.message,
    });
  }
};


// ===================== GET ALL TRANSACTIONS =====================
exports.getAllTransactions = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;
    const query = {};

    if (req.query.search?.trim()) {
      const regex = new RegExp(req.query.search.trim(), "i");
      query.$or = [
        { narration: regex },
        { chqNo: regex },
        { source: regex }
      ];
    }

    if (req.query.fromDate || req.query.toDate) {
      query.date = {};
      if (req.query.fromDate) query.date.$gte = new Date(req.query.fromDate);
      if (req.query.toDate) {
        const end = new Date(req.query.toDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (req.query.valueFromDate || req.query.valueToDate) {
      query.valueDate = {};
      if (req.query.valueFromDate) query.valueDate.$gte = new Date(req.query.valueFromDate);
      if (req.query.valueToDate) {
        const end = new Date(req.query.valueToDate);
        end.setHours(23, 59, 59, 999);
        query.valueDate.$lte = end;
      }
    }

    if (req.query.source) query.source = req.query.source;
    if (req.query.userId) query.userId = req.query.userId;

    if (req.query.chqNo) {
      query.chqNo = { $regex: req.query.chqNo, $options: "i" };
    }

    if (req.query.narration) {
      query.narration = {
        $regex: req.query.narration,
        $options: "i"
      };
    } else if (req.query.transactionType === "salary") {
      // Salary table → ONLY salary transactions
      query.narration = {
        $regex: "salary",
        $options: "i"
      };
    } else {
      // Normal table → Salary transactions exclude
      query.narration = {
        $not: /salary/i
      };
    }

    if (req.query.minAmount || req.query.maxAmount) {
      const min = Number(req.query.minAmount || 0);
      const max = Number(req.query.maxAmount || Number.MAX_SAFE_INTEGER);

      query.$and = [{
        $or: [
          { withdrawal: { $gte: min, $lte: max } },
          { deposit: { $gte: min, $lte: max } }
        ]
      }];
    }

    if (req.query.transactionType === "deposit") {
      query.deposit = { $gt: 0 };
    }

    if (req.query.transactionType === "withdrawal") {
      query.withdrawal = { $gt: 0 };
    }

    const accounts = [
      { model: AC1Transaction, account: "AC1" },
      { model: AC2Transaction, account: "AC2" },
      { model: AC3Transaction, account: "AC3" },
      { model: AC4Transaction, account: "AC4" },
      { model: AC5Transaction, account: "AC5" }
    ];

    const expenseCodeOptions = await OptionsData.findOne({
      categoryKey: "expensecode",
    })
      .select("items")
      .lean();

    const expenseCodeMap = new Map(
      (expenseCodeOptions?.items || []).map((item) => [
        String(item._id),
        {
          label: item.label,
          value: item.value,
          id: item._id,
        },
      ])
    );
    let allTransactions = [];

    for (const account of accounts) {
      const data = await account.model
        .find(query)
        .populate("userId", "fullName")
        .populate("propertyId", "propertyCode")
        .lean();

      allTransactions.push(
        ...data.map(transaction => ({
          ...transaction,
          expenseCode: transaction.expenseCode
            ? expenseCodeMap.get(String(transaction.expenseCode)) || null
            : null,
          account: account.account
        }))
      );
    }

    allTransactions.sort((a, b) => {
      const createdDiff =
        new Date(b.createdAt) - new Date(a.createdAt);

      if (createdDiff !== 0) return createdDiff;

      return String(b._id).localeCompare(String(a._id));
    });

    const totalRecords = allTransactions.length;
    const totalPages = Math.ceil(totalRecords / limit);

    const transactions = allTransactions.slice(
      skip,
      skip + limit
    );

    return res.status(200).json({
      success: true,
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      count: transactions.length,
      data: transactions
    });

  } catch (error) {
    console.error("Get Transactions Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
      error: error.message
    });
  }
};

// ===================== GET SINGLE TRANSACTION =====================
exports.getTransactionById = async (req, res) => {
  try {
    const { account, id } = req.params;
        console.log(1111111111, account ,  id)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID"
      });
    }

    const accountModels = {
      AC1: AC1Transaction,
      AC2: AC2Transaction,
      AC3: AC3Transaction,
      AC4: AC4Transaction,
      AC5: AC5Transaction
    };

    const accountKey = account?.toUpperCase();
    const TransactionModel = accountModels[accountKey];
    const expenseCodeOptions = await OptionsData.findOne({
      categoryKey: "expensecode",
    })
      .select("items")
      .lean();

    const expenseCodeMap = new Map(
      (expenseCodeOptions?.items || []).map((item) => [
        String(item._id),
        {
          label: item.label,
          value: item.value,
          id: item._id,
        },
      ])
    );
    if (!TransactionModel) {
      return res.status(400).json({
        success: false,
        message: "Invalid account. Use AC1, AC2, AC3, AC4 or AC5."
      });
    }

    const transactionData = await TransactionModel.findById(id)
      .populate("userId", "fullName")
      .populate("propertyId", "propertyCode")
      .lean();

    if (!transactionData) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    const transaction = {
      ...transactionData,

      propertyCode:
        transactionData.propertyId?.propertyCode || "",

      propertyId:
        transactionData.propertyId?._id ||
        transactionData.propertyId ||
        "",
      expenseCode: transactionData.expenseCode
        ? expenseCodeMap.get(String(transactionData.expenseCode)) || null
        : null,

      account: accountKey
    };

    return res.status(200).json({
      success: true,
      data: transaction
    });

  } catch (error) {
    console.error("Get Transaction Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch transaction",
      error: error.message
    });
  }
};

// ===================== UPDATE TRANSACTION =====================
exports.updateTransaction = async (req, res) => {
  try {
    const { account, id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID",
      });
    }

    const accountModels = {
      AC1: AC1Transaction,
      AC2: AC2Transaction,
      AC3: AC3Transaction,
      AC4: AC4Transaction,
      AC5: AC5Transaction,
    };

    const accountKey = account?.toUpperCase();
    const TransactionModel = accountModels[accountKey];

    if (!TransactionModel) {
      return res.status(400).json({
        success: false,
        message: "Invalid account",
      });
    }

    const transaction = await TransactionModel.findById(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    const userName = req?.body?.updatedByName || "";
    const propertyId = req.body.propertyId?.toString().trim() || "";
    const expenseCode = req.body.expenseCode?.toString().trim() || "";
    const updates = {};

    // Property / Expense Code
    if (propertyId) {
      if (!mongoose.Types.ObjectId.isValid(propertyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Property ID",
        });
      }

      updates.propertyId = propertyId;
      updates.expenseCode = null;
    }

    if (expenseCode) {
      if (!mongoose.Types.ObjectId.isValid(expenseCode)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Expense Code ID",
        });
      }

      updates.expenseCode = expenseCode;
      updates.propertyId = null;
    }

    // Other fields
    if (req.body.expenseCategory !== undefined) {
      updates.expenseCategory = req.body.expenseCategory;
    }

    if (req.body.status !== undefined) {
      updates.status = req.body.status;
    }

    if (req.body.comment !== undefined) {
      updates.comment = req.body.comment;
    }

    if (req.body.isMapped !== undefined) {
      updates.isMapped = req.body.isMapped === true || req.body.isMapped === "true";
    }

    // Work log changes
    const changes = [];

    const fields = [
      { key: "status", label: "Status" },
      { key: "expenseCategory", label: "Expense Category" },
      { key: "isMapped", label: "Mapped" },
    ];

    fields.forEach(({ key, label }) => {
      const oldValue = transaction[key] ?? "";
      const newValue = req.body[key];

      if (
        newValue !== undefined &&
        String(oldValue) !== String(newValue)
      ) {
        if (key === "isMapped") {
          changes.push(
            `${label} changed from "${oldValue ? "Yes" : "No"}" to "${newValue === true || newValue === "true" ? "Yes" : "No"
            }"`
          );
        } else {
          changes.push(
            `${label} changed from "${oldValue || "Blank"}" to "${newValue || "Blank"}"`
          );
        }
      }
    });

    const oldPropertyId = transaction.propertyId
      ? String(transaction.propertyId)
      : "";

    if (propertyId && oldPropertyId !== propertyId) {
      changes.push(
        `Property changed from "${oldPropertyId || "Blank"}" to "${propertyId}"`
      );
    }

    const oldExpenseCode = transaction.expenseCode
      ? String(transaction.expenseCode)
      : "";

    if (expenseCode && oldExpenseCode !== expenseCode) {
      const expenseCodeData = await OptionsData.findOne({
        categoryKey: "expensecode",
        "items._id": expenseCode,
      }).lean();

      const expenseItem = expenseCodeData?.items?.find(
        (item) => String(item._id) === String(expenseCode)
      );

      const expenseCodeName =
        expenseItem?.label ||
        expenseItem?.value ||
        expenseCode;

      changes.push(
        `Expense Code changed from "${oldExpenseCode || "Blank"}" to "${expenseCodeName}"`
      );
    }

    // Comment
    const newComment = req.body.comment;

    if (
      newComment !== undefined &&
      String(newComment).trim() !== ""
    ) {
      changes.push(`Comment: "${String(newComment).trim()}"`);
    }

    // Status user assignment
    const newStatus = req.body.status;

    if (
      newStatus &&
      String(transaction.status || "") !== String(newStatus)
    ) {
      updates.assignee = userName;
      changes.push(`Assigned to "${userName}"`);

      if (newStatus === "Review Done") {
        updates.reviewer = userName;
        changes.push(`Reviewer assigned to "${userName}"`);
      }

      if (newStatus === "Closed") {
        updates.auditor = userName;
        changes.push(`Auditor assigned to "${userName}"`);
      }
    }

    // Work log
    const workLogs = transaction.workLogs || [];

    if (changes.length > 0) {
      workLogs.push({
        message: changes.join("\n"),
        createdBy: userName,
        createdAt: new Date(),
      });
    }

    updates.workLogs = workLogs;

    const updatedTransaction =
      await TransactionModel.findByIdAndUpdate(
        id,
        { $set: updates },
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("userId", "fullName")
        .populate("propertyId", "propertyCode")
        .lean();

    return res.status(200).json({
      success: true,
      message: "Transaction updated successfully",
      data: {
        ...updatedTransaction,
        propertyCode:
          updatedTransaction.propertyId?.propertyCode || "",
        propertyId:
          updatedTransaction.propertyId?._id ||
          updatedTransaction.propertyId ||
          "",
        account: accountKey,
      },
    });
  } catch (error) {
    console.error("Update Transaction Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update transaction",
      error: error.message,
    });
  }
};


exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID"
      });
    }

    const accounts = [
      { model: AC1Transaction, account: "AC1" },
      { model: AC2Transaction, account: "AC2" },
      { model: AC3Transaction, account: "AC3" },
      { model: AC4Transaction, account: "AC4" },
      { model: AC5Transaction, account: "AC5" }
    ];

    let transaction = null;
    let account = null;

    for (const item of accounts) {
      const data = await item.model.findByIdAndDelete(id);

      if (data) {
        transaction = data;
        account = item.account;
        break;
      }
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Transaction deleted successfully",
      account
    });

  } catch (error) {
    console.error("Delete Transaction Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete transaction",
      error: error.message
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
        message: "Please provide an array of transaction IDs"
      });
    }

    const invalidIds = ids.filter(
      id => !mongoose.Types.ObjectId.isValid(id)
    );

    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction IDs provided",
        invalidIds
      });
    }

    const accounts = [
      { model: AC1Transaction, account: "AC1" },
      { model: AC2Transaction, account: "AC2" },
      { model: AC3Transaction, account: "AC3" },
      { model: AC4Transaction, account: "AC4" },
      { model: AC5Transaction, account: "AC5" }
    ];

    let deletedCount = 0;
    const deletedTransactions = [];
    const notFoundIds = [...ids];

    for (const item of accounts) {
      const transactions = await item.model.find({
        _id: { $in: ids }
      }).select("_id");

      if (transactions.length > 0) {
        const foundIds = transactions.map(t => t._id.toString());

        const result = await item.model.deleteMany({
          _id: { $in: transactions.map(t => t._id) }
        });

        deletedCount += result.deletedCount;

        foundIds.forEach(id => {
          const index = notFoundIds.indexOf(id);
          if (index !== -1) {
            notFoundIds.splice(index, 1);
          }

          deletedTransactions.push({
            id,
            account: item.account
          });
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `${deletedCount} transactions deleted successfully`,
      deletedCount,
      deletedTransactions,
      notFoundIds
    });

  } catch (error) {
    console.error("Delete Multiple Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete transactions",
      error: error.message
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
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.date.$lte = end;
      }
    }

    const models = [
      { model: AC1Transaction, account: "AC1" },
      { model: AC2Transaction, account: "AC2" },
      { model: AC3Transaction, account: "AC3" },
      { model: AC4Transaction, account: "AC4" },
      { model: AC5Transaction, account: "AC5" }
    ];

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalTransactions = 0;
    const uniqueDays = new Set();

    for (const item of models) {
      const summary = await item.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalDeposits: { $sum: "$deposit" },
            totalWithdrawals: { $sum: "$withdrawal" },
            transactionCount: { $sum: 1 },
            uniqueDays: {
              $addToSet: {
                $dateToString: { format: "%Y-%m-%d", date: "$date" }
              }
            }
          }
        }
      ]);

      if (summary.length) {
        totalDeposits += summary[0].totalDeposits || 0;
        totalWithdrawals += summary[0].totalWithdrawals || 0;
        totalTransactions += summary[0].transactionCount || 0;
        summary[0].uniqueDays.forEach(day => uniqueDays.add(day));
      }
    }

    const netBalance = totalDeposits - totalWithdrawals;
    const averageDeposit = totalTransactions ? totalDeposits / totalTransactions : 0;
    const averageWithdrawal = totalTransactions ? totalWithdrawals / totalTransactions : 0;

    res.status(200).json({
      success: true,
      data: {
        totalDeposits,
        totalWithdrawals,
        totalTransactions,
        netBalance,
        averageDeposit,
        averageWithdrawal,
        dayCount: uniqueDays.size
      }
    });
  } catch (error) {
    console.error("Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get summary",
      error: error.message
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
      expenseCategory
    } = req.body;
    // ===============================
    // Check Transaction
    // ===============================
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID"
      });
    }

    const accounts = [
      { model: AC1Transaction, account: "AC1" },
      { model: AC2Transaction, account: "AC2" },
      { model: AC3Transaction, account: "AC3" },
      { model: AC4Transaction, account: "AC4" },
      { model: AC5Transaction, account: "AC5" }
    ];

    let transaction = null;
    let account = null;

    for (const item of accounts) {
      const found = await item.model.findById(transactionId);
      if (found) {
        transaction = found;
        account = item.account;
        break;
      }
    }

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
    if (!Array.isArray(history.paymentComments)) {
      history.paymentComments = [];
    }

    history.paymentComments.push({
      comment: `Amount: ₹${receivedAmount} - Narration: ${transaction.narration || "-"
        } - Value Date: ${transaction.valueDate
          ? new Date(transaction.valueDate).toLocaleDateString("en-IN")
          : "-"
        }`,
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
    // existing transaction values ko preserve karo
    transaction.expenseCategory = expenseCategory;

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
   console.log("narration", narration)
    if (!narration?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Narration is required"
      });
    }

    const accounts = [
      { model: AC1Transaction, account: "AC1" },
      { model: AC2Transaction, account: "AC2" },
      { model: AC3Transaction, account: "AC3" },
      { model: AC4Transaction, account: "AC4" },
      { model: AC5Transaction, account: "AC5" }
    ];

    let transaction = null;
    let account = null;

    for (const item of accounts) {
      const found = await item.model.findOne({
        narration: narration.trim()
      }).lean();

      if (found) {
        transaction = found;
        account = item.account;
        break;
      }
    }

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    return res.status(200).json({
      success: true,
      account,
      data: transaction
    });

  } catch (error) {
    console.error("Get Transaction By Narration Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch transaction",
      error: error.message
    });
  }
};