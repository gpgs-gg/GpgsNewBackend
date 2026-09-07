const Client = require("../models/client.model");

exports.getPropertyAndPersonalDetailsById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate(
        "propertyId",
        "propertyCode propertyName propertyLocation internet.wifiName internet.wifiPwd"
      )
      .populate("bedId", "roomNo bedNo monthlyRent acRoom");

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    res.status(200).json({
      success: true,
      data: client,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// .populate("propertyId" , "propertyCode propertyName internet.wifiName internetwifiPwd")