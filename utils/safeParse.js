// for nested property data 
const safeParse = (value) => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      return {};
    }
  }
  return value;
};

module.exports = safeParse;
