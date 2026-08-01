const Lead = require("../models/leads.model");
const {
  convertStringFormatDateTime,
  convertStringToDateTime,
} = require("../utils/dateFormatter");

const LeadsConJob = async () => {
  try {
    console.log("Running lead reassignment service...");

    const now = new Date();

    const leads = await Lead.find({
      LeadStatus: "New",
    });

    if (!leads.length) {
      console.log("No leads for reassignment");
      return;
    }

    const bulkOperations = [];

    for (const lead of leads) {
      if (!lead.Date || !lead.Time) continue;

      // Last transfer / lead time
      const leadDateTime = convertStringToDateTime(
        `${lead.Date} ${lead.Time}`
      );

      const diffMinutes =
        (now.getTime() - leadDateTime.getTime()) /
        (1000 * 60);



      // Wait 30 minutes
      if (diffMinutes < 30) {
        continue;
      }

      let newTeamCode = lead.TeamCode;

      if (lead.TeamCode === "Sales-1") {
        newTeamCode = "Sales-2";
      } else if (lead.TeamCode === "Sales-2") {
        newTeamCode = "Sales-1";
      } else {
        continue;
      }

      const current = convertStringFormatDateTime(
        new Date()
      );

      // current = "2026-07-29 04:45 PM"
      const [currentDate, currentTime, ampm] =
        current.split(" ");

      const time = `${currentTime} ${ampm}`;

      const historyLine = `${new Date().toLocaleDateString(
        "en-GB",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      )} ${new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })} | ${lead.TeamCode} -> ${newTeamCode}`;

      bulkOperations.push({
        updateOne: {
          filter: {
            _id: lead._id,
          },
          update: {
            $set: {
              TeamCode: newTeamCode,

              // IMPORTANT
              Date: currentDate,
              Time: time,

              TransferHistory: lead.TransferHistory
                ? `${lead.TransferHistory}\n${historyLine}`
                : historyLine,
            },
          },
        },
      });
    }

    if (bulkOperations.length) {
      await Lead.bulkWrite(bulkOperations);

      console.log(
        `${bulkOperations.length} leads transferred successfully`
      );
    } else {
      console.log(
        "No eligible leads for reassignment"
      );
    }
  } catch (error) {
    console.error(
      "Lead Reassign Service Error:",
      error
    );
  }
};

module.exports = {
  LeadsConJob,
};