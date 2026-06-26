require("dotenv").config();
// const clientStatusCron =  require("./cron/clientStatusCron");

const app = require("./app");
const connectDB = require("./config/db");

// MongoDB Connect
connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  // clientStatusCron()
  console.log(`🚀 Server running on port ${PORT}`);
});