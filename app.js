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
const errorHandler = require("./middleware/errorHandler");
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
app.use("/api/rent-history",RentHistoryRoutes);
app.use("/api/tickets",TicketsRoutes);
app.use("/api/toggle-client-login",ToggleClientLogin);
app.use("/api/bank", bankTransactionRoutes);

app.use((req, res, next) => {
  next(new ApiError(404, `Route Not Found - ${req.originalUrl}`));
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;