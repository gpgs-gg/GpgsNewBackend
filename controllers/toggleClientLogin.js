const Client = require("../models/client.model");
const User = require("../models/user.model");
const Booking = require("../models/newBooking.model");

exports.toggleClientLogin = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const loginEnabled = !booking.loginEnabled;

    // Update Booking
    booking.loginEnabled = loginEnabled;
    await booking.save();

    // Update all clients of this booking
    await Client.updateMany(
      { bookingId: booking._id },
      {
        $set: {
          loginEnabled,
        },
      }
    );

    // Permanent client first, otherwise first available client
    let client = await Client.findOne({
      bookingId: booking._id,
    });

    if (!client) {
      client = await Client.findOne({
        bookingId: booking._id,
      });
    }

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "No client found for this booking.",
      });
    }

    if (loginEnabled) {
      let user = await User.findOne({
        bookingId: booking._id,
      });

      if (!user) {
        user = await User.create({
          name: client.fullName,
          email: client.emailId,
          password: "123456",
          role: "Client",
          bookingId: booking._id,
          isActive: true,
        });
      } else {
        user.name = client.fullName;
        user.email = client.emailId;
        user.isActive = true;

        await user.save();
      }
    } else {
      await User.findOneAndUpdate(
        {
          bookingId: booking._id,
        },
        {
          $set: {
            isActive: false,
          },
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: loginEnabled
        ? "Client login enabled successfully."
        : "Client login disabled successfully.",
      loginEnabled,
    });
  } catch (err) {
    console.error("Toggle Client Login Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};