process.env.TZ = "Asia/Kolkata";
const express = require("express");
const propertyRoutes = require("./routes/propertyRoutes");
const bedRoutes = require("./routes/bedRoutes");
const authRoutes = require("./routes/authRoutes");
const clientRoutes = require("./routes/clientRoutes");
const bedAvailableRoutes = require("./routes/bedAvailableRoutes");
const bedTransferRoutes = require("./routes/bedTransferRoutes");
const newBookingRoutes = require("./routes/newBookingRoutes");
const RentHistoryRoutes = require("./routes/clientRentHistoryRoutes");
const TicketsRoutes = require("./routes/ticketRoutes");
const ToggleClientLogin = require("./routes/toggleClientRoutes");
const bankTransactionRoutes = require("./routes/bankTransactionRoutes");
const optionsDataRoutes = require("./routes/optionsRoutes");
const errorHandler = require("./middleware/errorHandler");
const UserRoutes = require("./routes/userRoutes");
const LeadsRoutes = require("./routes/leadsRoutes");
const GlobalSettingRoutes = require("./routes/globalSettingRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const employeesRoutes = require("./routes/employeeRoutes");
const housekeepingRoutes = require("./routes/houseKeepingRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const rentNotReceivedRoutes = require("./routes/rentNotReceivedCommentRoutes");
const salaryRoutes = require("./routes/salaryRoutes");
const acebAreaRoutes = require("./routes/acebAreaRoutes");
const acebReadingRoutes = require("./routes/acebReadingRoutes");
const ebInfoRoutes = require("./routes/ebInfoRoutes");
const clientTicketsRoutes = require("./clientRoutes/clientTIcketRouets");
const otpRoutes = require("./routes/otpRoutes.js");
const sidebarModuleRoutes = require("./routes/sidebarModuleRoutes.js");
const rolePermissionRoutes = require("./routes/rolePermissionRoutes");
const clientVacationRoutes = require('./routes/clientVacationRoutes');
const ebCalculatorRoutes = require('./routes/ebCalculatorRoutes.js');
const updateEbAmtRoutes = require('./routes/UpdateEbAmtRoutes.js')
const propertyAndPersonalRoutes = require('./clientRoutes/propertyAndPersonalRoutes.js')

const ApiError = require("./utils/ApiError");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

// app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "GPGS Backend Running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api", bedAvailableRoutes);
app.use("/api/beds", bedRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api", bedTransferRoutes);
app.use("/api/new-bookings", newBookingRoutes);
app.use("/api/rent-history", RentHistoryRoutes);
app.use("/api/tickets", TicketsRoutes);
app.use("/api/toggle-client-login", ToggleClientLogin);
app.use("/api/bank", bankTransactionRoutes);
app.use("/api/options", optionsDataRoutes);
app.use("/api/users", UserRoutes);
app.use("/api/leads", LeadsRoutes);
app.use("/api", GlobalSettingRoutes);
app.use("/api/housekeeping", housekeepingRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api", rentNotReceivedRoutes);
app.use("/api/salaries", salaryRoutes);
app.use("/api/aceb-area", acebAreaRoutes);
app.use("/api/aceb-reading", acebReadingRoutes);
app.use("/api/electricity-bill-info", ebInfoRoutes);
app.use("/api/client-tickets", clientTicketsRoutes);
app.use("/api/otp", otpRoutes)
app.use("/api/modules", sidebarModuleRoutes);
app.use("/api/permissions", rolePermissionRoutes);
app.use('/api/vacation-history', clientVacationRoutes);
app.use("/api", ebCalculatorRoutes);
app.use("/api", updateEbAmtRoutes);
app.use("/api", propertyAndPersonalRoutes);

app.use((req, res, next) => {
  next(new ApiError(404, `Route Not Found - ${req.originalUrl}`));
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;