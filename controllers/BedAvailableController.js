const Client = require("../models/client.model");
const Bed = require("../models/bed.model");

exports.getAllAvailableBeds = async (req, res) => {

  try {
    const now = new Date();

    const clients = await Client.find().lean();
    const beds = await Bed.find()
      .populate("propertyId", "propertyCode")
      .lean();
    // =========================
    // MAP CLIENTS BY bedId (STRING SAFE)
    // =========================
    const clientMap = new Map();
    clients.forEach((c) => {
      if (!c.bedId) return;
      clientMap.set(String(c.bedId), c);
    });
    // =========================
    // FIND OCCUPIED BEDS
    // =========================
    const occupiedBedIds = [];
    clients.forEach((c) => {
      if (!c.bedId) return;
      // Cancelled booking => Available
      if (c.isBookingCancelled === true) return;
      const vacatingDate = c.clientVacatingDate
        ? new Date(c.clientVacatingDate)
        : null;
      const noticeDate = c.noticeStartDate
        ? new Date(c.noticeStartDate)
        : null;
      // Notice diya hua => Available
      if (noticeDate) return;
      // Vacating date aa gayi => Available
      if (vacatingDate && now >= vacatingDate) return;
      // Otherwise occupied 
      occupiedBedIds.push(String(c.bedId));
    });
    // =========================
    // FILTER AVAILABLE BEDS
    // =========================
    const availableBeds = beds.filter(
      (b) => !occupiedBedIds.includes(String(b._id))
    );
    // =========================
    // ATTACH CLIENT DATA
    // =========================
    const result = availableBeds.map((bed) => {
      const client = clientMap.get(String(bed._id));
      return {
        ...bed,
        client: client
          ? {
            _id: client._id,
            fullName: client.fullName,
            callingNo: client.callingNo,
            whatsappNo: client.whatsappNo,
            noticeStartDate: client.noticeStartDate,
            noticeLastDate: client.noticeLastDate,
            clientVacatingDate: client.clientVacatingDate,
            rentStartDate: client.rentStartDate,
            isBookingCancelled: client.isBookingCancelled,
          }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// };
// PROPERTY WISE AVAILABLE
exports.getPropertyWiseAvailableBeds = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const now = new Date();

    const clients = await Client.find({
      propertyId,
    }).lean();

    const occupiedBedIds = [];

    clients.forEach((client) => {
      if (!client.bedId) return;

      // Cancelled booking = Available
      if (client.isBookingCancelled) return;

      const noticeDate = client.noticeStartDate
        ? new Date(client.noticeStartDate)
        : null;

      const vacatingDate = client.clientVacatingDate
        ? new Date(client.clientVacatingDate)
        : null;

      // Notice diya hua = Available
      if (noticeDate) return;

      // Vacating date nikal gayi = Available
      if (vacatingDate && now >= vacatingDate) return;

      // Otherwise Occupied
      occupiedBedIds.push(client.bedId);
    });

    const availableBeds = await Bed.find({
      propertyId,
      _id: { $nin: occupiedBedIds },
    }).populate("propertyId", "propertyCode propertyName");

    return res.status(200).json({
      success: true,
      count: availableBeds.length,
      data: availableBeds,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};