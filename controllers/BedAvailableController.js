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

//pooja code
exports.getAllAvailableBeds = async (req, res) => {
  try {
    const now = new Date();

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

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

    const query = {};

    if (propertyId) query.propertyId = propertyId;
    if (gender) query.gender = gender;
    if (sharingType) query.sharingType = sharingType;
    if (bathAttached) query.bathAttached = bathAttached;
    if (acRoom) query.acRoom = acRoom;
    if (status) query.status = status;
    if (roomNo) query.roomNo = roomNo;
    if (bedNo) query.bedNo = bedNo;

    if (monthlyRentMin || monthlyRentMax) {
      query.monthlyRent = {};
      if (monthlyRentMin) query.monthlyRent.$gte = Number(monthlyRentMin);
      if (monthlyRentMax) query.monthlyRent.$lte = Number(monthlyRentMax);
    }

    if (depositAmountMin || depositAmountMax) {
      query.depositAmount = {};
      if (depositAmountMin) query.depositAmount.$gte = Number(depositAmountMin);
      if (depositAmountMax) query.depositAmount.$lte = Number(depositAmountMax);
    }

    if (propertyLocation) {
      const properties = await Property.find({ propertyLocation }).select("_id").lean();
      query.propertyId = { $in: properties.map(p => p._id) };
    }

    if (search?.trim()) {
      const regex = new RegExp(search.trim(), "i");
      const properties = await Property.find({
        $or: [{ propertyCode: regex }, { propertyLocation: regex }]
      }).select("_id").lean();
      
      query.$or = [
        { roomNo: regex },
        { bedNo: regex },
        { sharingType: regex },
        { gender: regex },
        { bathAttached: regex },
        { acRoom: regex },
        { status: regex },
        ...(properties.length ? [{ propertyId: { $in: properties.map(p => p._id) } }] : [])
      ];
    }

    // ================= 💨 STEP 1: Get occupied bed IDs using distinct (FAST) =================
    // 🔥 Yeh 40K clients pe bhi < 100ms me kaam karega agar index hai
    const occupiedBedIds = await Client.distinct("bedId", {
      bedId: { $exists: true, $ne: null },
      isBookingCancelled: { $ne: true },
      noticeStartDate: { $exists: false },
      $or: [
        { clientVacatingDate: { $exists: false } },
        { clientVacatingDate: { $gt: now } }
      ]
    });

    if (occupiedBedIds.length > 0) {
      query._id = { $nin: occupiedBedIds };
    }

    // ================= 💨 STEP 2: Parallel queries (FASTER) =================
    let sortOption = { createdAt: -1 };
    if (sortByRent === "true") {
      sortOption = { monthlyRent: 1 };
    }

    // 🔥 Dono queries parallel me chal rahi hain
    const [totalRecords, beds] = await Promise.all([
      Bed.countDocuments(query),
      Bed.find(query)
        .populate("propertyId", "propertyCode propertyLocation")
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    // ================= 💨 STEP 3: Get clients for these beds only =================
    const bedIds = beds.map(b => b._id);
    
    // 🔥 Sirf 10-20 clients fetch ho rahe hain, 40K nahi
    let clients = [];
    if (bedIds.length > 0) {
      clients = await Client.find({
        bedId: { $in: bedIds }
        // ❌ Koi extra filter nahi - sab clients chahiye
      })
      .select("_id bedId fullName callingNo whatsappNo noticeStartDate noticeLastDate clientVacatingDate clientDoj isBookingCancelled")
      .lean();
    }

    // ================= 💨 STEP 4: Map for O(1) lookup =================
    const clientMap = new Map();
    clients.forEach(c => {
      clientMap.set(String(c.bedId), c);
    });

    // ================= 💨 STEP 5: Format response =================
    let data = beds.map(bed => {
      const client = clientMap.get(String(bed._id));
      return {
        ...bed,
        client: client ? {
          _id: client._id,
          fullName: client.fullName,
          callingNo: client.callingNo,
          whatsappNo: client.whatsappNo,
          noticeStartDate: client.noticeStartDate,
          noticeLastDate: client.noticeLastDate,
          clientVacatingDate: client.clientVacatingDate,
          clientDoj: client.clientDoj,
          isBookingCancelled: client.isBookingCancelled
        } : null
      };
    });

    // ================= 💨 STEP 6: CVD sorting (Sirf 10-20 records pe) =================
    if (hasCvd === "true") {
      data.sort((a, b) => {
        const aDate = a.client?.clientVacatingDate ? new Date(a.client.clientVacatingDate) : null;
        const bDate = b.client?.clientVacatingDate ? new Date(b.client.clientVacatingDate) : null;
        
        if (aDate === null && bDate !== null) return -1;
        if (aDate !== null && bDate === null) return 1;
        if (aDate === null && bDate === null) {
          if (sortByRent === "true") {
            return a.monthlyRent - b.monthlyRent;
          }
          return 0;
        }
        
        const dateDiff = aDate - bDate;
        if (dateDiff !== 0) return dateDiff;
        
        if (sortByRent === "true") {
          return a.monthlyRent - b.monthlyRent;
        }
        return 0;
      });
    }

    return res.status(200).json({
      success: true,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      hasNextPage: page < Math.ceil(totalRecords / limit),
      hasPrevPage: page > 1,
      count: data.length,
      data
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
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




