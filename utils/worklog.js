const { convertStringFormatDateTime } = require("./dateFormatter");

/**
 * Convert field name to readable format
 */
const formatFieldName = (key) => {
  return key
    .replace(/Id$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
};

/**
 * Check whether field should be ignored
 */
const shouldIgnoreField = (key, ignoredFields = []) => {
  const ignored = [
    "_id",
    "__v",
    "worklogs",
    "createdat",
    "updatedat",
    "newworklog",
    "createdbyname",
    "updatedbyname",
    "aadharcardexisting",
    "photoexisting",
    "attachmentexisting",
    ...ignoredFields,
  ];

  return ignored.some(
    (field) => String(field).toLowerCase() === String(key).toLowerCase(),
  );
};

/**
 * Convert date/value into comparable display value
 */
const normalizeValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  // Date object from MongoDB
  if (value instanceof Date) {
    return convertStringFormatDateTime(value);
  }

  // Date only: 2026-09-30
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return convertStringFormatDateTime(date);
  }

  // ISO date: 2026-09-30T00:00:00.000Z
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);

    if (!isNaN(date.getTime())) {
      return convertStringFormatDateTime(date);
    }
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

/**
 * Recursively compare old and new objects
 */
const getChangedFields = (
  oldData,
  newData,
  parentPath = "",
  ignoredFields = [],
) => {
  const changes = [];

  const oldObject = oldData && typeof oldData === "object" ? oldData : {};

  const newObject = newData && typeof newData === "object" ? newData : {};

  const keys = new Set([...Object.keys(oldObject), ...Object.keys(newObject)]);

  for (const key of keys) {
    // ⭐ IMPORTANT
    // Ignore workLogs, createdAt, updatedAt, etc.
    if (shouldIgnoreField(key, ignoredFields)) {
      continue;
    }

    const oldValue = oldObject[key];
    const newValue = newObject[key];

    const currentPath = parentPath ? `${parentPath}.${key}` : key;

    /**
     * Nested object
     */
    if (
      oldValue &&
      newValue &&
      typeof oldValue === "object" &&
      typeof newValue === "object" &&
      !Array.isArray(oldValue) &&
      !Array.isArray(newValue) &&
      !(oldValue instanceof Date) &&
      !(newValue instanceof Date)
    ) {
      changes.push(
        ...getChangedFields(oldValue, newValue, currentPath, ignoredFields),
      );

      continue;
    }

    const oldNormalized = normalizeValue(oldValue);
    const newNormalized = normalizeValue(newValue);

    if (oldNormalized !== newNormalized) {
      const readablePath = currentPath
        .split(".")
        .map(formatFieldName)
        .join(" ");

      changes.push(
        `${readablePath} changed from "${oldNormalized || "Blank"}" to "${
          newNormalized || "Blank"
        }"`,
      );
    }
  }

  return changes;
};

/**
 * Create WorkLog
 */
const createWorkLog = ({ message, createdBy = "System" }) => {
  return {
    message,
    createdBy,
    createdAt: convertStringFormatDateTime(new Date()),
  };
};

/**
 * Generate automatic WorkLogs
 */
const generateWorkLogs = ({
  oldData,
  newData,
  createdBy = "System",
  ignoredFields = [],
}) => {
  const changes = getChangedFields(oldData, newData, "", ignoredFields);

  if (changes.length === 0) {
    return [];
  }

  return [
    createWorkLog({
      message: changes.join("\n"),
      createdBy,
    }),
  ];
};

module.exports = {
  getChangedFields,
  createWorkLog,
  generateWorkLogs,
  formatFieldName,
};