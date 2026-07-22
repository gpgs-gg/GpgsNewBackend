const Client = require("../models/client.model");
const Bed = require("../models/bed.model");
const Property = require("../models/property.model");

  // ye abhishek ka code h 
// exports.getAllAvailableBeds = async (req, res) => {

//   try {
//     const now = new Date();

//     const clients = await Client.find().lean();
//     const beds = await Bed.find()
//       .populate("propertyId", "propertyCode")
//       .lean();
//     // =========================
//     // MAP CLIENTS BY bedId (STRING SAFE)
//     // =========================
//     const clientMap = new Map();
//     clients.forEach((c) => {
//       if (!c.bedId) return;
//       clientMap.set(String(c.bedId), c);
//     });
//     // =========================
//     // FIND OCCUPIED BEDS
//     // =========================
//     const occupiedBedIds = [];
//     clients.forEach((c) => {
//       if (!c.bedId) return;
//       // Cancelled booking => Available
//       if (c.isBookingCancelled === true) return;
//       const vacatingDate = c.clientVacatingDate
//         ? new Date(c.clientVacatingDate)
//         : null;
//       const noticeDate = c.noticeStartDate
//         ? new Date(c.noticeStartDate)
//         : null;
//       // Notice diya hua => Available
//       if (noticeDate) return;
//       // Vacating date aa gayi => Available
//       if (vacatingDate && now >= vacatingDate) return;
//       // Otherwise occupied 
//       occupiedBedIds.push(String(c.bedId));
//     });
//     // =========================
//     // FILTER AVAILABLE BEDS
//     // =========================
//     const availableBeds = beds.filter(
//       (b) => !occupiedBedIds.includes(String(b._id))
//     );
//     // =========================
//     // ATTACH CLIENT DATA
//     // =========================
//     const result = availableBeds.map((bed) => {
//       const client = clientMap.get(String(bed._id));
//       return {
//         ...bed,
//         client: client
//           ? {
//             _id: client._id,
//             fullName: client.fullName,
//             callingNo: client.callingNo,
//             whatsappNo: client.whatsappNo,
//             noticeStartDate: client.noticeStartDate,
//             noticeLastDate: client.noticeLastDate,
//             clientVacatingDate: client.clientVacatingDate,
//             clientDoj: client.clientDoj,
//             isBookingCancelled: client.isBookingCancelled,
//           }
//           : null,
//       };
//     });

//     return res.status(200).json({
//       success: true,
//       count: result.length,
//       data: result,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

exports.getAllAvailableBeds = async (req, res) => {
  try {
    const now = new Date();

    // ================= Pagination =================
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    // ================= Query Params =================
    //pooja
    const {
      search,
      propertyId,
      propertyLocation,
      gender,
      sharingType,
      bathAttached,
      acRoom,
      roomNo,
      bedNo,
      status,
      monthlyRentMin,
      monthlyRentMax,
      depositAmountMin,
      depositAmountMax,
      hasCvd,
      sortByRent,
    } = req.query;
    //
    // ================= Clients =================
    const clients = await Client.find().lean();

    // ================= Occupied Beds =================
    const occupiedBedIds = [];

    clients.forEach((client) => {
      if (!client.bedId) return;

      if (client.isBookingCancelled) return;

      const vacatingDate = client.clientVacatingDate
        ? new Date(client.clientVacatingDate)
        : null;

      const noticeDate = client.noticeStartDate
        ? new Date(client.noticeStartDate)
        : null;

      if (noticeDate) return;

      if (vacatingDate && now >= vacatingDate) return;

      occupiedBedIds.push(client.bedId);
    });

    // ================= Build Bed Query =================
    const query = {
      _id: {
        $nin: occupiedBedIds,
      },
    };

    if (propertyId) query.propertyId = propertyId;
    if (gender) query.gender = gender;
    if (sharingType) query.sharingType = sharingType;
    if (bathAttached) query.bathAttached = bathAttached;
    if (acRoom) query.acRoom = acRoom;
    if (status) query.status = status;
    if (roomNo) query.roomNo = roomNo;
    if (bedNo) query.bedNo = bedNo;

    // ================= Rent Filter =================
    if (monthlyRentMin || monthlyRentMax) {
      query.monthlyRent = {};

      if (monthlyRentMin) query.monthlyRent.$gte = Number(monthlyRentMin);

      if (monthlyRentMax) query.monthlyRent.$lte = Number(monthlyRentMax);
    }

    // ================= Deposit Filter =================
    if (depositAmountMin || depositAmountMax) {
      query.depositAmount = {};

      if (depositAmountMin) query.depositAmount.$gte = Number(depositAmountMin);

      if (depositAmountMax) query.depositAmount.$lte = Number(depositAmountMax);
    }

    // ================= Property Location =================
    if (propertyLocation) {
      const properties = await Property.find({
        propertyLocation,
      }).select("_id");

      query.propertyId = {
        $in: properties.map((p) => p._id),
      };
    }

    // ================= Search =================
    if (search?.trim()) {
      const regex = new RegExp(search.trim(), "i");

      const properties = await Property.find({
        $or: [{ propertyCode: regex }, { propertyLocation: regex }],
      }).select("_id");

      const propertyIds = properties.map((p) => p._id);

      query.$or = [
        { roomNo: regex },
        { bedNo: regex },
        { sharingType: regex },
        { gender: regex },
        { bathAttached: regex },
        { acRoom: regex },
        { status: regex },
        ...(propertyIds.length ? [{ propertyId: { $in: propertyIds } }] : []),
      ];
    }

    // ================= Total Count =================
    const totalRecords = await Bed.countDocuments(query);

    // ================= Fetch Beds =================
    let beds;

    if (hasCvd === "true" || sortByRent === "true") {
      // Fetch all records for global sorting
      beds = await Bed.find(query)
        .populate("propertyId", "propertyCode propertyLocation")
        .lean();
    } else {
      // Existing behavior
      beds = await Bed.find(query)
        .populate("propertyId", "propertyCode propertyLocation")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    }
    // ================= Map Clients =================
    const clientMap = new Map();

    clients.forEach((client) => {
      if (!client.bedId) return;

      clientMap.set(String(client.bedId), client);
    });

    // ================= Response =================
    const data = beds.map((bed) => {
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
              clientDoj: client.clientDoj,
              isBookingCancelled: client.isBookingCancelled,
            }
          : null,
      };
    });

    // pooja
    data.sort((a, b) => {
      if (hasCvd === "true") {
        const aHasDate = !!a.client?.clientVacatingDate;
        const bHasDate = !!b.client?.clientVacatingDate;

        // Records without CVD should come first
        if (!aHasDate && bHasDate) return -1;
        if (aHasDate && !bHasDate) return 1;

        // If both have dates, compare them
        if (aHasDate && bHasDate) {
          const dateDiff =
            new Date(a.client.clientVacatingDate) -
            new Date(b.client.clientVacatingDate);

          if (dateDiff !== 0) return dateDiff;
        }
      }

      // Rent sorting (if enabled)
      if (sortByRent === "true") {
        return a.monthlyRent - b.monthlyRent;
      }

      return 0;
    });
    let finalData = data;

    if (hasCvd === "true" || sortByRent === "true") {
      finalData = data.slice(skip, skip + limit);
    }
    // data.sort((a, b) => {
    //   // CVD sorting (if enabled)
    //   if (hasCvd === "true") {
    //     const aDate = a.client?.clientVacatingDate
    //       ? new Date(a.client.clientVacatingDate)
    //       : new Date("9999-12-31");

    //     const bDate = b.client?.clientVacatingDate
    //       ? new Date(b.client.clientVacatingDate)
    //       : new Date("9999-12-31");

    //     const dateDiff = aDate - bDate;

    //     if (dateDiff !== 0) return dateDiff;
    //   }

    //   // Rent sorting (if enabled)
    //   if (sortByRent === "true") {
    //     return a.monthlyRent - b.monthlyRent;
    //   }

    //   return 0;
    // });
    //pooja
    return res.status(200).json({
      success: true,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      hasNextPage: page < Math.ceil(totalRecords / limit),
      hasPrevPage: page > 1,
      count: finalData.length,
      data: finalData,
      // count: data.length,
      // data,
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




