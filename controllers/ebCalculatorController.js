const Client = require("../models/client.model");
const Property = require("../models/property.model");
const ClientVacationHistory = require("../models/clientVacationHistory.model");

// exports.getPropertyEbClients = async (req, res) => {
//   try {
//     const { propertyId } = req.params;

//     // ==========================================
//     // PROPERTY
//     // ==========================================
//     const property = await Property.findById(propertyId)
//       .select("propertyCode propertyLocation utility")
//       .lean();

//     if (!property) {
//       return res.status(404).json({
//         success: false,
//         message: "Property not found",
//       });
//     }
// // ==========================================
// // EB CYCLE DATE CALCULATION
// // ==========================================

// const ebStartCycle = property.utility?.ebStartCycle;
// const ebEndCycle = property.utility?.ebEndCycle;  

// if (!ebStartCycle || !ebEndCycle) {
//   return res.status(400).json({
//     success: false,
//     message: "EB start cycle and EB end cycle are not configured",
//   });
// }

// const today = new Date();

// const currentYear = today.getFullYear();
// const currentMonth = today.getMonth();
// const currentDay = today.getDate();

// const formatDate = (date) => {
//   const year = date.getFullYear();
//   const month = String(date.getMonth() + 1).padStart(2, "0");
//   const day = String(date.getDate()).padStart(2, "0");

//   return `${year}-${month}-${day}`;
// };

// let cycleStart;
// let cycleEnd;

// if (currentDay >= ebStartCycle) {
//   cycleStart = new Date(
//     currentYear,
//     currentMonth,
//     ebStartCycle
//   );

//   cycleEnd = new Date(
//     currentYear,
//     currentMonth + 1,
//     ebEndCycle
//   );
// } else {
//   cycleStart = new Date(
//     currentYear,
//     currentMonth - 1,
//     ebStartCycle
//   );

//   cycleEnd = new Date(
//     currentYear,
//     currentMonth,
//     ebEndCycle
//   );
// }

// const cycleStartDate = formatDate(cycleStart);
// const cycleEndDate = formatDate(cycleEnd);

// console.log("EB CYCLE:", {
//   cycleStartDate,
//   cycleEndDate,
// });

// // ==========================================
// // ACTIVE CLIENTS FOR EB CYCLE
// // ==========================================

// const clients = await Client.find({
//   propertyId,

//   isBookingCancelled: false,

//   // Client joined before EB cycle ended
//   clientDoj: {
//     $lte: cycleEndDate,
//   },

//   // Client stayed at least some part
//   // of the EB cycle
//   $or: [
//     {
//       clientVacatingDate: {
//         $gte: cycleStartDate,
//       },
//     },
//     {
//       clientVacatingDate: null,
//     },
//     {
//       clientVacatingDate: "",
//     },
//     {
//       clientVacatingDate: {
//         $exists: false,
//       },
//     },
//   ],
// })
//   .select(
//     "fullName clientDoj clientVacatingDate ebDoj propertyId bedId stayType"
//   )
//   .populate(
//     "bedId",
//     "roomNo bedNo monthlyRent depositAmount freeEbAsPerBed acRoom"
//   )
//   .lean();    // ==========================================
//     // CLIENT IDS
//     // ==========================================
//     const clientIds = clients.map(
//       (client) => client._id
//     );

//     // ==========================================
//     // VACATION HISTORY
//     // ==========================================
//     let vacations = [];

//     if (clientIds.length > 0) {
//       vacations = await ClientVacationHistory.find({
//         clientId: {
//           $in: clientIds,
//         },
//       })
//         .select(
//           "clientId month year vacationStartDate1 vacationLastDate1 vacationStartDate2 vacationLastDate2"
//         )
//         .lean();
//     }

//     // ==========================================
//     // VACATION MAP
//     // ==========================================
//     const vacationMap = new Map();

//     vacations.forEach((vacation) => {
//       const clientId = vacation.clientId.toString();

//       if (!vacationMap.has(clientId)) {
//         vacationMap.set(clientId, []);
//       }

//       vacationMap.get(clientId).push({
//         _id: vacation._id,

//         month: vacation.month,

//         year: vacation.year,

//         vacationStartDate1:
//           vacation.vacationStartDate1 || null,

//         vacationLastDate1:
//           vacation.vacationLastDate1 || null,

//         vacationStartDate2:
//           vacation.vacationStartDate2 || null,

//         vacationLastDate2:
//           vacation.vacationLastDate2 || null,
//       });
//     });

//     // ==========================================
//     // FINAL CLIENT DATA
//     // ==========================================
//     const responseClients = clients.map((client) => ({
//       ...client,

//       vacations:
//         vacationMap.get(
//           client._id.toString()
//         ) || [],
//     }));

//     // ==========================================
//     // RESPONSE
//     // ==========================================
//     return res.status(200).json({
//       success: true,

//       data: {
//         property: {
//           _id: property._id,

//           propertyCode:
//             property.propertyCode,

//           propertyLocation:
//             property.propertyLocation,

//           utility: {
//             ebStartCycle:
//               property.utility?.ebStartCycle || null,

//             ebEndCycle:
//               property.utility?.ebEndCycle || null,
//           },

//           // Useful for frontend / calculation
//           currentEbCycle: {
//             startDate: cycleStartDate,
//             endDate: cycleEndDate,
//           },
//         },

//         clients: responseClients,
//       },
//     });
//   } catch (error) {
//     console.error(
//       "Get Property EB Clients Error:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


exports.getPropertyEbClients = async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Frontend se optional dates
    const { startDate, endDate } = req.query;
   console.log("startDate, endDate" , startDate, endDate)
    // ==========================================
    // PROPERTY
    // ==========================================

    const property = await Property.findById(propertyId)
      .select("propertyCode propertyLocation utility")
      .lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // ==========================================
    // EB CYCLE DATE
    // ==========================================

    let cycleStartDate;
    let cycleEndDate;

    // ==========================================
    // CASE 1:
    // FRONTEND SE DATE AAYI HAI
    // ==========================================

    if (startDate && endDate) {
      cycleStartDate = startDate;
      cycleEndDate = endDate;

      console.log("EB CYCLE FROM FRONTEND:", {
        cycleStartDate,
        cycleEndDate,
      });
    }

    // ==========================================
    // CASE 2:
    // FRONTEND SE DATE NAHI AAYI
    // OLD / EXISTING LOGIC
    // ==========================================

    else {
      const ebStartCycle = property.utility?.ebStartCycle;
      const ebEndCycle = property.utility?.ebEndCycle;

      if (!ebStartCycle || !ebEndCycle) {
        return res.status(400).json({
          success: false,
          message:
            "EB start cycle and EB end cycle are not configured",
        });
      }

      const today = new Date();

      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const currentDay = today.getDate();

      const formatDate = (date) => {
        const year = date.getFullYear();

        const month = String(
          date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
          date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;
      };

      let cycleStart;
      let cycleEnd;

      if (currentDay >= ebStartCycle) {
        cycleStart = new Date(
          currentYear,
          currentMonth,
          ebStartCycle
        );

        cycleEnd = new Date(
          currentYear,
          currentMonth + 1,
          ebEndCycle
        );
      } else {
        cycleStart = new Date(
          currentYear,
          currentMonth - 1,
          ebStartCycle
        );

        cycleEnd = new Date(
          currentYear,
          currentMonth,
          ebEndCycle
        );
      }

      cycleStartDate = formatDate(cycleStart);
      cycleEndDate = formatDate(cycleEnd);

      console.log("EB CYCLE FROM PROPERTY:", {
        cycleStartDate,
        cycleEndDate,
      });
    }

    // ==========================================
    // ACTIVE CLIENTS FOR EB CYCLE
    // ==========================================

    const clients = await Client.find({
      propertyId,

      isBookingCancelled: false,

      // Client joined before EB cycle ended
      clientDoj: {
        $lte: cycleEndDate,
      },

      // Client stayed at least some part
      // of EB cycle
      $or: [
        {
          clientVacatingDate: {
            $gte: cycleStartDate,
          },
        },

        {
          clientVacatingDate: null,
        },

        {
          clientVacatingDate: "",
        },

        {
          clientVacatingDate: {
            $exists: false,
          },
        },
      ],
    })
      .select(
        "fullName clientDoj clientVacatingDate ebDoj propertyId bedId stayType"
      )
      .populate(
        "bedId",
        "roomNo bedNo monthlyRent depositAmount freeEbAsPerBed acRoom"
      )
      .lean();

    // ==========================================
    // CLIENT IDS
    // ==========================================

    const clientIds = clients.map(
      (client) => client._id
    );

    // ==========================================
    // VACATION HISTORY
    // ==========================================

    let vacations = [];

    if (clientIds.length > 0) {
      vacations = await ClientVacationHistory.find({
        clientId: {
          $in: clientIds,
        },
      })
        .select(
          "clientId month year vacationStartDate1 vacationLastDate1 vacationStartDate2 vacationLastDate2"
        )
        .lean();
    }

    // ==========================================
    // VACATION MAP
    // ==========================================

    const vacationMap = new Map();

    vacations.forEach((vacation) => {
      const clientId =
        vacation.clientId.toString();

      if (!vacationMap.has(clientId)) {
        vacationMap.set(clientId, []);
      }

      vacationMap.get(clientId).push({
        _id: vacation._id,

        month: vacation.month,

        year: vacation.year,

        vacationStartDate1:
          vacation.vacationStartDate1 || null,

        vacationLastDate1:
          vacation.vacationLastDate1 || null,

        vacationStartDate2:
          vacation.vacationStartDate2 || null,

        vacationLastDate2:
          vacation.vacationLastDate2 || null,
      });
    });

    // ==========================================
    // FINAL CLIENT DATA
    // ==========================================

    const responseClients = clients.map(
      (client) => ({
        ...client,

        vacations:
          vacationMap.get(
            client._id.toString()
          ) || [],
      })
    );

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,

      data: {
        property: {
          _id: property._id,

          propertyCode:
            property.propertyCode,

          propertyLocation:
            property.propertyLocation,

          utility: {
            ebStartCycle:
              property.utility?.ebStartCycle ||
              null,

            ebEndCycle:
              property.utility?.ebEndCycle ||
              null,
          },

          currentEbCycle: {
            startDate: cycleStartDate,
            endDate: cycleEndDate,
          },
        },

        clients: responseClients,
      },
    });
  } catch (error) {
    console.error(
      "Get Property EB Clients Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};