// // services/clientLogin.service.js

// const Client = require("../models/client.model");
// const User = require("../models/user.model");
// const Booking = require("../models/newBooking.model");

// const enableClientLogin = async (bookingId) => {
//   const booking = await Booking.findById(bookingId);

//   if (!booking) {
//     throw new Error("Booking not found");
//   }

//   booking.loginEnabled = true;
//   await booking.save();

//   await Client.updateMany(
//     { bookingId },
//     {
//       $set: {
//         loginEnabled: true,
//       },
//     }
//   );
//   const client = await Client.findOne({ bookingId });
//   if (!client) {
//     throw new Error("Client not found");
//   }

//   let user = await User.findOne({ bookingId });
//   if (!user) {
//     await User.create({
//       name: client.fullName,
//       email: client.emailId,
//       password: "123456",
//       role: "Client",
//       bookingId,
//       isActive: true,
//     });
//   } else {
//     user.name = client.fullName;
//     user.email = client.emailId;
//     user.isActive = true;
//     await user.save();
//   }
// };

// module.exports = {
//   enableClientLogin,
// };

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

  // User already linked with this booking?
  let user = await User.findOne({ bookingId });

  if (user) {
    user.name = client.fullName;
    user.email = client.emailId;
    user.isActive = true;

    await user.save();

    return;
  }

const existingEmailUser = await User.findOne({
  email: client.emailId,
  role: "Client",
});

if (existingEmailUser) {
  if (
    existingEmailUser.bookingId &&
    existingEmailUser.bookingId.toString() === bookingId.toString()
  ) {
    existingEmailUser.clientId = client._id;
    await existingEmailUser.save();
    return;
  }

  if (existingEmailUser.isActive) {
    throw new Error(
      "A client with this email is already active."
    );
  }

  existingEmailUser.name = client.fullName;
  existingEmailUser.email = client.emailId;
  existingEmailUser.bookingId = bookingId;
  existingEmailUser.clientId = client._id;
  existingEmailUser.role = "Client";
  existingEmailUser.password = "123456";
  existingEmailUser.isActive = true;

  await existingEmailUser.save();

  return;
}

  // Create new user
 await User.create({
  name: client.fullName,
  email: client.emailId,
  password: "123456",
  role: "Client",
  bookingId,
  clientId: client._id,
  isActive: true,
});
};

module.exports = {
  enableClientLogin,
};