const errorHandler = (err, req, res, next) => {
  console.error(err);

  // Response has already been sent.
  // Do not send another response.
  if (res.headersSent) {
    return next(err);
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

module.exports = errorHandler;