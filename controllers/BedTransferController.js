
const Client = require("../models/client.model");
const transferBed = async (req, res) => {
  try {
    const {
      clientId,
      newPropertyId,
      newBedId,
    } = req.body;

    if (
      !clientId ||
      !newPropertyId ||
      !newBedId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "clientId, newPropertyId and newBedId are required",
      });
    }

    const client = await Client.findById(
      clientId
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Same Property + Same Bed
    if (
      String(client.propertyId) ===
      String(newPropertyId) &&
      String(client.bedId) ===
      String(newBedId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Client is already assigned to this bed",
      });
    }

    // Check Occupied Bed
    const occupied =
      await Client.findOne({
        _id: { $ne: clientId },
        propertyId: newPropertyId,
        bedId: newBedId,
        isBookingCancelled: false,

        $or: [
          {
            noticeStartDate: {
              $exists: false,
            },
          },
          {
            noticeStartDate: null,
          },
        ],
      });

    if (occupied) {
      return res.status(400).json({
        success: false,
        message:
          "Bed already occupied",
      });
    }

    // Close Previous History
    const lastHistory =
      client.bedHistory?.[
      client.bedHistory.length - 1
      ];

    if (lastHistory) {
      lastHistory.toDate =
        new Date();
    }

    const oldPropertyId =
      client.propertyId;

    const oldBedId = client.bedId;

    const now = new Date();

    // First transfer
    if (!client.bedHistory || client.bedHistory.length === 0) {
      client.bedHistory = [];

      // Current bed history
      client.bedHistory.push({
        propertyId: client.propertyId,
        bedId: client.bedId,
        stayType: client.stayType || "Permanent",
        fromDate: client.rentStartDate || now,
        toDate: now,
      });
    } else {
      // Close current active history
      const lastHistory =
        client.bedHistory[
        client.bedHistory.length - 1
        ];

      if (!lastHistory.toDate) {
        lastHistory.toDate = now;
      }
    }

    // New History Entry
    client.bedHistory.push({
      propertyId: newPropertyId,
      bedId: newBedId,
      stayType:
        client.stayType ||
        "P.Booked",
      fromDate: new Date(),
      toDate: null,
    });

    // Update Current Property + Bed
    client.propertyId =
      newPropertyId;
    client.bedId = newBedId;

    // Worklog
    client.worklogs.push({
      message: `Client shifted from Property ${oldPropertyId} Bed ${oldBedId} to Property ${newPropertyId} Bed ${newBedId}`,
      createdAt: new Date(),
    });

    await client.save();

    const updatedClient =
      await Client.findById(
        client._id
      )
        .populate(
          "propertyId",
          "propertyCode propertyName"
        )
        .populate(
          "bedId",
          "bedCode roomNo bedNo monthlyRent depositAmount"
        )
        .populate(
          "bedHistory.propertyId",
          "propertyCode propertyName"
        )
        .populate(
          "bedHistory.bedId",
          "bedCode roomNo bedNo monthlyRent depositAmount"
        );

    return res.status(200).json({
      success: true,
      message:
        "Bed transferred successfully",
      data: updatedClient,
    });
  } catch (error) {
    console.error(
      "Transfer Bed Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  transferBed,
};

