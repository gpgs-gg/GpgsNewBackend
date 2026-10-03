

  // fast code there is not added IA , RF ,total this is fast ...............

// const Client = require("../models/client.model");
// const Bed = require("../models/bed.model");
// const Property = require("../models/property.model");
// const Booking = require("../models/newBooking.model");


// exports.getAllAvailableBeds = async (req, res) => {
//   try {
//     const now = new Date();
//     const page = Math.max(parseInt(req.query.page) || 1, 1);
//     const limit = Math.max(parseInt(req.query.limit) || 10000, 1);
//     const skip = (page - 1) * limit;

//     const {
//       search,
//       propertyId,
//       propertyLocation,
//       gender,
//       sharingType,
//       bathAttached,
//       acRoom,
//       roomNo,
//       bedNo,
//       status,
//       monthlyRentMin,
//       monthlyRentMax,
//       depositAmountMin,
//       depositAmountMax,
//       hasCvd,
//       sortByRent,
//     } = req.query;

//     const query = {};

//     if (propertyId) query.propertyId = propertyId;
//     if (gender) query.gender = gender;
//     if (sharingType) query.sharingType = sharingType;
//     if (bathAttached) query.bathAttached = bathAttached;
//     if (acRoom) query.acRoom = acRoom;
//     if (status) query.status = status;
//     if (roomNo) query.roomNo = roomNo;
//     if (bedNo) query.bedNo = bedNo;
//     query.status = "Active";


//     if (monthlyRentMin || monthlyRentMax) {
//       query.monthlyRent = {};
//       if (monthlyRentMin) query.monthlyRent.$gte = Number(monthlyRentMin);
//       if (monthlyRentMax) query.monthlyRent.$lte = Number(monthlyRentMax);
//     }

//     if (depositAmountMin || depositAmountMax) {
//       query.depositAmount = {};
//       if (depositAmountMin) query.depositAmount.$gte = Number(depositAmountMin);
//       if (depositAmountMax) query.depositAmount.$lte = Number(depositAmountMax);
//     }

//     if (propertyLocation) {
//       const properties = await Property.find({ propertyLocation }).select("_id").lean();
//       query.propertyId = { $in: properties.map(p => p._id) };
//     }

//     if (search?.trim()) {
//       const regex = new RegExp(search.trim(), "i");
//       const properties = await Property.find({
//         $or: [{ propertyCode: regex }, { propertyLocation: regex }]
//       }).select("_id").lean();

//       query.$or = [
//         { roomNo: regex },
//         { bedNo: regex },
//         { sharingType: regex },
//         { gender: regex },
//         { bathAttached: regex },
//         { acRoom: regex },
//         { status: regex },
//         ...(properties.length ? [{ propertyId: { $in: properties.map(p => p._id) } }] : [])
//       ];
//     }

//     // ================= 💨 STEP 1: Get occupied bed IDs using distinct (FAST) =================
//     //  const occupiedBedIds = await Client.distinct("bedId", {
//     //   bedId: { $exists: true, $ne: null },
//     //   isBookingCancelled: { $ne: true },

//     //   // Normal active client = occupied
//     //   $or: [
//     //     // Notice start nahi hua
//     //     {
//     //       $or: [
//     //         { noticeStartDate: { $exists: false } },
//     //         { noticeStartDate: "" },
//     //         { noticeStartDate: null }
//     //       ]
//     //     },

//     //     // Notice hai but vacating date future ki hai
//     //     {
//     //       noticeStartDate: { $nin: ["", null] },
//     //       $or: [
//     //         { clientVacatingDate: { $exists: false } },
//     //         { clientVacatingDate: "" },
//     //         { clientVacatingDate: null },
//     //         { clientVacatingDate: { $gt: today } }
//     //       ]
//     //     }
//     //   ]
//     // });
//     // ................................................
//     // const occupiedBedIds = await Client.distinct("bedId", {
//     //   bedId: { $exists: true, $ne: null },
//     //   isBookingCancelled: { $ne: true },

//     //   // Sirf wahi clients occupied hain jinka notice nahi hai
//     //   $or: [
//     //     { noticeStartDate: { $exists: false } },
//     //     { noticeStartDate: "" },
//     //     { noticeStartDate: null }
//     //   ]
//     // });

//     // if (occupiedBedIds.length > 0) {
//     //   query._id = { $nin: occupiedBedIds };
//     // }

//     // 1️⃣ Active clients → Bed actually occupied
//     const occupiedBedIds = await Client.distinct("bedId", {
//       bedId: { $exists: true, $ne: null },
//       isBookingCancelled: { $ne: true },

//       // Sirf wahi clients occupied hain jinka notice nahi hai
//       $or: [
//         { noticeStartDate: { $exists: false } },
//         { noticeStartDate: "" },
//         { noticeStartDate: null }
//       ]
//     });

//     // 2️⃣ Pending bookings → Bed temporarily reserved
//     // Payment verify nahi hua + hold expire nahi hua
//     const pendingBookingBedIds = await Booking.distinct("bedId", {
//       bedId: { $exists: true, $ne: null },
//       status: "Booked",
//       loginEnabled: false,
//     });

//     // 3️⃣ Client occupied + pending booking reserved
//     const unavailableBedIds = [
//       ...occupiedBedIds,
//       ...pendingBookingBedIds
//     ];

//     if (unavailableBedIds.length > 0) {
//       query._id = { $nin: unavailableBedIds };
//     }


//     // ================= 💨 STEP 2: Parallel queries (FASTER) =================
//     let sortOption = { createdAt: -1 };
//     if (sortByRent === "true") {
//       sortOption = { monthlyRent: 1 };
//     }

//     // 🔥 Dono queries parallel me chal rahi hain
//     let totalRecords;
//     let beds;

//     if (hasCvd === "true") {
//       // CVD sorting needs ALL matching beds before pagination
//       [totalRecords, beds] = await Promise.all([
//         Bed.countDocuments(query),
//         Bed.find(query)
//           .populate("propertyId", "propertyCode propertyLocation")
//           .sort(sortOption)
//           .lean(),
//       ]);
//     } else {
//       // Normal case: keep DB-level pagination for performance
//       [totalRecords, beds] = await Promise.all([
//         Bed.countDocuments(query),
//         Bed.find(query)
//           .populate("propertyId", "propertyCode propertyLocation")
//           .sort(sortOption)
//           .skip(skip)
//           .limit(limit)
//           .lean(),
//       ]);
//     }

//     // ================= 💨 STEP 3: Get clients for these beds =================

//     const bedIds = beds.map(b => b._id);

//     let clients = [];

//     if (bedIds.length > 0) {
//       clients = await Client.find({
//         $or: [
//           // Current bed clients
//           {
//             bedId: { $in: bedIds }
//           },

//           // Transfer ke baad old bed par historical client
//           {
//             "bedHistory.bedId": { $in: bedIds }
//           }
//         ]
//       })
//         .select(
//           "_id bedId fullName callingNo whatsappNo noticeStartDate noticeLastDate clientVacatingDate clientDoj isBookingCancelled bedHistory"
//         )
//         .lean();
//     }

//  // ================= 💨 STEP 4: Map for O(1) lookup =================

// const clientMap = new Map();

// clients.forEach(c => {
//   // Current bed client
//   if (c.bedId) {
//     clientMap.set(String(c.bedId), c);
//   }

//   // Old bed from bedHistory
//   if (Array.isArray(c.bedHistory)) {
//     c.bedHistory.forEach(history => {
//       if (!history.bedId) return;

//       // Old bed ka historical record
//       if (
//         history.clientVacatingDate ||
//         history.noticeStartDate ||
//         history.noticeLastDate ||
//         history.toDate
//       ) {
//         clientMap.set(String(history.bedId), {
//           ...c,

//           // Old bed ki dates
//           noticeStartDate:
//             history.noticeStartDate || c.noticeStartDate,

//           noticeLastDate:
//             history.noticeLastDate || c.noticeLastDate,

//           clientVacatingDate:
//             history.clientVacatingDate ||
//             history.toDate ||
//             c.clientVacatingDate,

//           clientDoj:
//             history.fromDate || c.clientDoj,

//           bedId: history.bedId,
//         });
//       }
//     });
//   }
// });


// // ================= 💨 STEP 5: Format response =================
// let data = beds.map(bed => {
//   const client = clientMap.get(String(bed._id));

//   return {
//     ...bed,

//     client: client
//       ? {
//           _id: client._id,
//           fullName: client.fullName,
//           callingNo: client.callingNo,
//           whatsappNo: client.whatsappNo,

//           noticeStartDate: client.noticeStartDate,
//           noticeLastDate: client.noticeLastDate,
//           clientVacatingDate: client.clientVacatingDate,

//           clientDoj: client.clientDoj,
//           isBookingCancelled: client.isBookingCancelled,
//         }
//       : null,
//   };
// });
//     // ================= 💨 STEP 6: CVD sorting (Sirf 10-20 records pe) =================
//     if (hasCvd === "true") {
//       data.sort((a, b) => {
//         const aDate = a.client?.clientVacatingDate ? new Date(a.client.clientVacatingDate) : null;
//         const bDate = b.client?.clientVacatingDate ? new Date(b.client.clientVacatingDate) : null;

//         if (aDate === null && bDate !== null) return -1;
//         if (aDate !== null && bDate === null) return 1;
//         if (aDate === null && bDate === null) {
//           if (sortByRent === "true") {
//             return a.monthlyRent - b.monthlyRent;
//           }
//           return 0;
//         }

//         const dateDiff = aDate - bDate;
//         if (dateDiff !== 0) return dateDiff;

//         if (sortByRent === "true") {
//           return a.monthlyRent - b.monthlyRent;
//         }
//         return 0;
//       });
//     }

//     // Apply pagination AFTER CVD sorting
//     if (hasCvd === "true") {
//       data = data.slice(skip, skip + limit);
//     }
//     return res.status(200).json({
//       success: true,
//       page,
//       limit,
//       totalRecords,
//       totalPages: Math.ceil(totalRecords / limit),
//       hasNextPage: page < Math.ceil(totalRecords / limit),
//       hasPrevPage: page > 1,
//       count: data.length,
//       data
//     });

//   } catch (error) {
//     console.error('Error:', error);
//     return res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };


const Client = require("../models/client.model");
const Bed = require("../models/bed.model");
const Property = require("../models/property.model");
const Booking = require("../models/newBooking.model");

exports.getAllAvailableBeds = async (req, res) => {
  try {
    const now = new Date();
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10000, 1);
    const skip = (page - 1) * limit;

    const {
      search,
      propertyId,
      gender,
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

    const propertyLocation =
      req.query.propertyLocation || req.query["propertyLocation[]"];

    const sharingType = req.query.sharingType || req.query["sharingType[]"];

    const query = {};

    if (propertyId) query.propertyId = propertyId;
    if (gender) query.gender = gender;
    if (sharingType) {
      const sharingTypes = Array.isArray(sharingType)
        ? sharingType
        : [sharingType];
      query.sharingType = {
        $in: sharingTypes,
      };
    }
    if (bathAttached) query.bathAttached = bathAttached;
    if (acRoom) query.acRoom = acRoom;
    if (status) query.status = status;
    if (roomNo) query.roomNo = roomNo;
    if (bedNo) query.bedNo = bedNo;
    query.status = "Active";


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
      const locations = Array.isArray(propertyLocation)
        ? propertyLocation
        : [propertyLocation];

      const properties = await Property.find({
        propertyLocation: { $in: locations },
      })
        .select("_id")
        .lean();

      query.propertyId = {
        $in: properties.map((p) => p._id),
      };
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
    //  const occupiedBedIds = await Client.distinct("bedId", {
    //   bedId: { $exists: true, $ne: null },
    //   isBookingCancelled: { $ne: true },

    //   // Normal active client = occupied
    //   $or: [
    //     // Notice start nahi hua
    //     {
    //       $or: [
    //         { noticeStartDate: { $exists: false } },
    //         { noticeStartDate: "" },
    //         { noticeStartDate: null }
    //       ]
    //     },

    //     // Notice hai but vacating date future ki hai
    //     {
    //       noticeStartDate: { $nin: ["", null] },
    //       $or: [
    //         { clientVacatingDate: { $exists: false } },
    //         { clientVacatingDate: "" },
    //         { clientVacatingDate: null },
    //         { clientVacatingDate: { $gt: today } }
    //       ]
    //     }
    //   ]
    // });
    // ................................................
    // const occupiedBedIds = await Client.distinct("bedId", {
    //   bedId: { $exists: true, $ne: null },
    //   isBookingCancelled: { $ne: true },

    //   // Sirf wahi clients occupied hain jinka notice nahi hai
    //   $or: [
    //     { noticeStartDate: { $exists: false } },
    //     { noticeStartDate: "" },
    //     { noticeStartDate: null }
    //   ]
    // });

    // if (occupiedBedIds.length > 0) {
    //   query._id = { $nin: occupiedBedIds };
    // }

    // 1️⃣ Active clients → Bed actually occupied
    const occupiedBedIds = await Client.distinct("bedId", {
      bedId: { $exists: true, $ne: null },
      isBookingCancelled: { $ne: true },

      // Sirf wahi clients occupied hain jinka notice nahi hai
      $or: [
        { noticeStartDate: { $exists: false } },
        { noticeStartDate: "" },
        { noticeStartDate: null }
      ]
    });

    // 2️⃣ Pending bookings → Bed temporarily reserved
    // Payment verify nahi hua + hold expire nahi hua
    const pendingBookingBedIds = await Booking.distinct("bedId", {
      bedId: { $exists: true, $ne: null },
      status: "Booked",
      loginEnabled: false,
    });

    // 3️⃣ Client occupied + pending booking reserved
    const unavailableBedIds = [
      ...occupiedBedIds,
      ...pendingBookingBedIds
    ];

    if (unavailableBedIds.length > 0) {
      query._id = { $nin: unavailableBedIds };
    }


    // ================= 💨 STEP 2: Parallel queries (FASTER) =================
    let sortOption = { createdAt: -1 };
    if (sortByRent === "true") {
      sortOption = { monthlyRent: 1 };
    }

    // 🔥 Dono queries parallel me chal rahi hain
    let totalRecords;
    let beds;

    if (hasCvd === "true") {
      // CVD sorting needs ALL matching beds before pagination
      [totalRecords, beds] = await Promise.all([
        Bed.countDocuments(query),
        Bed.find(query)
          .populate("propertyId", "propertyCode propertyLocation")
          .sort(sortOption)
          .lean(),
      ]);
    } else {
      // Normal case: keep DB-level pagination for performance
      [totalRecords, beds] = await Promise.all([
        Bed.countDocuments(query),
        Bed.find(query)
          .populate("propertyId", "propertyCode propertyLocation")
          .sort(sortOption)
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);
    }

    // ================= 💨 STEP 3: Get clients for these beds =================
    // ================= ALL MATCHING BED IDS =================
    const allMatchingBeds = await Bed.find(query)
      .select("_id")
      .lean();
    const allBedIds = allMatchingBeds.map((b) => b._id);

    const bedIds = beds.map(b => b._id);

    let clients = [];

    if (bedIds.length > 0) {
      clients = await Client.find({
        $or: [
          // Current bed clients
          {
            bedId: { $in: bedIds }
          },

          // Transfer ke baad old bed par historical client
          {
            "bedHistory.bedId": { $in: bedIds }
          }
        ]
      })
        .select(
          "_id bedId fullName callingNo whatsappNo noticeStartDate noticeLastDate clientVacatingDate clientDoj isBookingCancelled bedHistory"
        )
        .lean();
    }
    // ================= 💨 STEP 3.1: Map for O(1) lookup =================

    let allClients = [];

    if (allBedIds.length > 0) {
      allClients = await Client.find({
        $or: [
          {
            bedId: { $in: allBedIds }
          },
          {
            "bedHistory.bedId": { $in: allBedIds }
          }
        ]
      })
        .select(
          "_id bedId noticeStartDate noticeLastDate clientVacatingDate clientDoj isBookingCancelled bedHistory"
        )
        .lean();
    }

    // ================= 💨 STEP 4: Map for O(1) lookup =================

    const clientMap = new Map();

    clients.forEach(c => {
      // Current bed client
      if (c.bedId) {
        clientMap.set(String(c.bedId), c);
      }

      // Old bed from bedHistory
      if (Array.isArray(c.bedHistory)) {
        c.bedHistory.forEach(history => {
          if (!history.bedId) return;

          // Old bed ka historical record
          if (
            history.clientVacatingDate ||
            history.noticeStartDate ||
            history.noticeLastDate ||
            history.toDate
          ) {
            clientMap.set(String(history.bedId), {
              ...c,

              // Old bed ki dates
              noticeStartDate:
                history.noticeStartDate || c.noticeStartDate,

              noticeLastDate:
                history.noticeLastDate || c.noticeLastDate,

              clientVacatingDate:
                history.clientVacatingDate ||
                history.toDate ||
                c.clientVacatingDate,

              clientDoj:
                history.fromDate || c.clientDoj,

              bedId: history.bedId,
            });
          }
        });
      }
    });

    // ================= ALL CLIENT MAP =================

    const allClientMap = new Map();

    allClients.forEach((c) => {
      if (c.bedId) {
        allClientMap.set(String(c.bedId), c);
      }

      if (Array.isArray(c.bedHistory)) {
        c.bedHistory.forEach((history) => {
          if (!history.bedId) return;

          if (
            history.clientVacatingDate ||
            history.noticeStartDate ||
            history.noticeLastDate ||
            history.toDate
          ) {
            allClientMap.set(String(history.bedId), {
              ...c,

              noticeStartDate:
                history.noticeStartDate || c.noticeStartDate,

              noticeLastDate:
                history.noticeLastDate || c.noticeLastDate,

              clientVacatingDate:
                history.clientVacatingDate ||
                history.toDate ||
                c.clientVacatingDate,

              clientDoj:
                history.fromDate || c.clientDoj,

              bedId: history.bedId,
            });
          }
        });
      }
    });

    // ================= ALL DATA IA + RED FLAG COUNT =================

    let IACount = 0;
    let redFlag = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    allBedIds.forEach((bedId) => {
      const client = allClientMap.get(String(bedId));

      // ================= IMMEDIATE AVAILABLE =================

      const cvd = client?.clientVacatingDate;

      if (!cvd) {
        IACount++;
      } else {
        const cvdDate = new Date(cvd);
        cvdDate.setHours(0, 0, 0, 0);

        if (cvdDate <= today) {
          IACount++;
        }
      }

      // ================= RED FLAG =================

      const nld = client?.noticeLastDate;

      if (!nld) {
        redFlag++;
      } else {
        const nldDate = new Date(nld);
        nldDate.setHours(0, 0, 0, 0);

        const diffDays =
          (nldDate - today) / (1000 * 60 * 60 * 24);

        if (diffDays <= 15) {
          redFlag++;
        }
      }
    });
    // ================= 💨 STEP 5: Format response =================
    let data = beds.map(bed => {
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

    // Apply pagination AFTER CVD sorting
    if (hasCvd === "true") {
      data = data.slice(skip, skip + limit);
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
      IACount,
      redFlag,
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




