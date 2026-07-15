// services/clientLogin.service.js

const Client = require("../models/client.model");
const User = require("../models/user.model");
const Booking = require("../models/newBooking.model");

const enableClientLogin = async (bookingId) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  booking.loginEnabled = true;
  await booking.save();

  await Client.updateMany(
    { bookingId },
    {
      $set: {
        loginEnabled: true,
      },
    }
  );

  const client = await Client.findOne({ bookingId });

  if (!client) {
    throw new Error("Client not found");
  }

  let user = await User.findOne({ bookingId });

  if (!user) {
    await User.create({
      name: client.fullName,
      email: client.emailId,
      password: "123456",
      role: "Client",
      bookingId,
      isActive: true,
    });
  } else {
    user.name = client.fullName;
    user.email = client.emailId;
    user.isActive = true;
    await user.save();
  }
};

module.exports = {
  enableClientLogin,
};