const cron = require("node-cron");

const {
  generateMonthlyRent,
} = require("../services/rentHistory.service");

// Every month 1st date at 01:00 AM
// cron.schedule("0 0 1 20 * *", async () => {
  // cron.schedule("0 0 1 27 * *", async () => {
cron.schedule("*/10 * * * * *", async () => {
  try {
    console.log("Monthly Rent Generation Started");
    const result = await generateMonthlyRent();
    console.log("Monthly Rent Generated");
    // console.log(result);
  } catch (err) {
    console.error(
      "Monthly Rent Cron Error:",
      err.message
    );
  }
});

console.log("Monthly Rent Cron Loaded");

//.................................................... 


// const cron = require("node-cron");

// const {
//   generateMonthlyRent,
// } = require("../services/rentHistory.service");

// // India Time (IST): Daily at 01:00 AM
// // Rent generation: Every month from 20th to last date
// cron.schedule(
//   "0 0 1 * * *",
//   async () => {
//     const today = new Date();

//     // Get current date according to Indian time
//     const indiaDate = new Date(
//       today.toLocaleString("en-US", {
//         timeZone: "Asia/Kolkata",
//       })
//     );

//     const day = indiaDate.getDate();

//     // Do not generate rent from 1st to 19th
//     if (day < 20) {
//       return;
//     }

//     try {
//       console.log(
//         "Monthly Rent Generation Started (IST):",
//         indiaDate.toLocaleString("en-IN", {
//           timeZone: "Asia/Kolkata",
//         })
//       );

//       await generateMonthlyRent();

//       console.log("Monthly Rent Generated Successfully");
//     } catch (err) {
//       console.error(
//         "Monthly Rent Cron Error:",
//         err.message
//       );
//     }
//   },
//   {
//     timezone: "Asia/Kolkata",
//   }
// );

// console.log("Monthly Rent Cron Loaded (IST)");
