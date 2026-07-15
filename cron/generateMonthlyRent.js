const cron = require("node-cron");

const {
  generateMonthlyRent,
} = require("../services/rentHistory.service");

// Every month 1st date at 01:00 AM
cron.schedule("0 1 1 * *", async () => {
// cron.schedule("*/30 * * * * *", async () => {
  try {
    console.log("Monthly Rent Generation Started");

    const result = await generateMonthlyRent();

    console.log("Monthly Rent Generated");
    console.log(result);
  } catch (err) {
    console.error(
      "Monthly Rent Cron Error:",
      err.message
    );
  }
});

console.log("Monthly Rent Cron Loaded");