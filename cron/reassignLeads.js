const cron = require("node-cron");
const GlobalSettings = require("../models/globalSettings.model");

const {
  LeadsConJob,
} = require("../services/leads.service");

// Every 30 Minutes
cron.schedule("*/30 * * * *", async () => {
  //  cron.schedule("* * * * *", async () => {
  try {
    // Check Global Setting
    const setting = await GlobalSettings.findOne();

    if (!setting?.leadAutoTransfer) {
      console.log("Lead Auto Transfer Disabled");
      return;
    }

    console.log("Lead Reassigned Started");

    await LeadsConJob();

    console.log("Lead Reassigned Completed");
  } catch (err) {
    console.error(
      "Lead Cron Error:",
      err.message
    );
  }
});

console.log("Lead Cron Loaded");