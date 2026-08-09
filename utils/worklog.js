const IGNORED_FIELDS = new Set([
  "_id",
  "__v",
  "password",
  "worklogs",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
]);

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeValue = (value) => {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  // Mongoose ObjectId
  if (
    value?._bsontype === "ObjectId" ||
    value?.constructor?.name === "ObjectId"
  ) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (isObject(value)) {
    const result = {};

    Object.keys(value)
      .sort()
      .forEach((key) => {
        result[key] = normalizeValue(value[key]);
      });

    return result;
  }

  return value;
};

const valuesEqual = (oldValue, newValue) => {
  return (
    JSON.stringify(normalizeValue(oldValue)) ===
    JSON.stringify(normalizeValue(newValue))
  );
};

const getChangedFields = (oldData, newData) => {
  const changes = [];

  const oldObject = oldData?.toObject ? oldData.toObject() : oldData || {};

  const newObject = newData?.toObject ? newData.toObject() : newData || {};

  const compare = (oldValue, newValue, path) => {
    // Ignore audit/system fields
    if (IGNORED_FIELDS.has(path)) {
      return;
    }

    // Arrays are treated as one field.
    // This is usually preferable for fields such as:
    // additionalAccess
    // emergencyContacts
    // documents.aadharCard
    if (Array.isArray(oldValue) || Array.isArray(newValue)) {
      if (!valuesEqual(oldValue, newValue)) {
        changes.push({
          field: path,
          oldValue: normalizeValue(oldValue),
          newValue: normalizeValue(newValue),
        });
      }

      return;
    }

    // Nested objects
    if (isObject(oldValue) || isObject(newValue)) {
      const oldObjectValue = isObject(oldValue) ? oldValue : {};
      const newObjectValue = isObject(newValue) ? newValue : {};

      const keys = new Set([
        ...Object.keys(oldObjectValue),
        ...Object.keys(newObjectValue),
      ]);

      for (const key of keys) {
        if (IGNORED_FIELDS.has(key)) {
          continue;
        }

        const currentPath = path ? `${path}.${key}` : key;

        compare(oldObjectValue[key], newObjectValue[key], currentPath);
      }

      return;
    }

    // Primitive / Date / ObjectId / null
    if (!valuesEqual(oldValue, newValue)) {
      changes.push({
        field: path,
        oldValue: normalizeValue(oldValue),
        newValue: normalizeValue(newValue),
      });
    }
  };

  const keys = new Set([...Object.keys(oldObject), ...Object.keys(newObject)]);

  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) {
      continue;
    }

    compare(oldObject[key], newObject[key], key);
  }

  return changes;
};

const addWorklog = ({
  document,
  action,
  changes = [],
  req,
  description = "",
}) => {
  if (!document) {
    throw new Error("Document is required for worklog.");
  }

  if (!action) {
    throw new Error("Worklog action is required.");
  }

  if (!Array.isArray(changes) || changes.length === 0) {
    return document;
  }

  const userId = req?.user?._id;

  const userName =
    req?.user?.name || req?.user?.fullName || req?.user?.employeeName || "";

  if (!userId) {
    throw new Error("Authenticated user is required to create a worklog.");
  }

  document.worklogs.push({
    action,
    description,
    changes,
    updatedBy: userId,
    updatedByName: userName,
    createdAt: new Date(),
  });

  return document;
};

module.exports = {
  getChangedFields,
  addWorklog,
};