const Lead = require("../models/leads.model");
const OptionsData = require("../models/options.model");
const LeadsConJob = async () => {
  try {
    console.log("Running lead reassignment service...");
    const teamOption = await OptionsData.findOne({
      categoryKey: "teamcode",
    }).lean();

    if (!teamOption) {
      console.log("TeamCode options not found");
      return;
    }

    const teamCodes = teamOption.items
      .filter((item) => item.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => item.value);

    if (!teamCodes.length) {
      console.log("No active TeamCodes found");
      return;
    }
    const leads = await Lead.find({
      LeadStatus: "New",
    });
    if (!leads.length) {
      console.log("No leads for reassignment");
      return;
    }
    const bulkOperations = [];
    let nextTeamIndex = 0;
    for (const lead of leads) {
      if (!lead.Time) continue;

      // ==========================
      // Compare ONLY Time
      // ==========================

      // Time format: "04:15 PM"
      const [time, ampm] = lead.Time.split(" ");

      let [hours, minutes] = time.split(":").map(Number);

      // Convert to 24-hour format
      if (ampm === "PM" && hours !== 12) {
        hours += 12;
      }

      if (ampm === "AM" && hours === 12) {
        hours = 0;
      }

      const now = new Date();

      // Today's date + stored time
      const leadTime = new Date();
      leadTime.setHours(hours, minutes, 0, 0);

      const diffMinutes =
        (now.getTime() - leadTime.getTime()) /
        (1000 * 60);
      if (diffMinutes < 30) {
        continue;
      }
      let newTeamCode;

      const currentIndex = teamCodes.indexOf(lead.TeamCode);

      if (currentIndex !== -1) {
        newTeamCode =
          teamCodes[(currentIndex + 1) % teamCodes.length];
      } else {
        // Empty किंवा invalid TeamCode
        newTeamCode = teamCodes[nextTeamIndex];
        nextTeamIndex =
          (nextTeamIndex + 1) % teamCodes.length;
      }
      // Current Time (12-hour format)
      const currentTime = new Date().toLocaleTimeString(
        "en-US",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }
      );
      // Transfer History
      const historyLine =
        `${new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })} ${currentTime} | ${lead.TeamCode} -> ${newTeamCode}`;
      bulkOperations.push({
        updateOne: {
          filter: {
            _id: lead._id,
          },
          update: {
            $set: {
              TeamCode: newTeamCode,

              // Date change honar nahi
              Time: currentTime,

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
      console.log("No eligible leads for reassignment");
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