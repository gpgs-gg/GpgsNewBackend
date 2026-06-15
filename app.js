const express = require("express");
const cors = require("cors");

const propertyRoutes = require("./routes/propertyRoutes");
const errorHandler = require("./middleware/errorHandler");
const ApiError = require("./utils/ApiError");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "GPGS Backend Running",
  });
});

app.use("/api/properties", propertyRoutes);

// 404 Handler
app.use((req, res, next) => {
  next(new ApiError(404, `Route Not Found - ${req.originalUrl}`));
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;