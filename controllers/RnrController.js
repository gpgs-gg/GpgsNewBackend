const Client = require("../models/client.model");
const Bed = require("../models/bed.model");
const Property = require("../models/property.model");
const ClientVacationHistory = require("../models/clientVacationHistory.model");
const ClientRentHistory = require("../models/clientRentHistory.model");
const RentNotReceivedComment = require("../models/rentNotReceivedComment.model");

exports.getAllRNRClients = async (req, res) => {
    try {
        // ================= Pagination =================
        const page = Math.max(parseInt(req.query.page) || 1, 1); // current page no.
        const limit = Math.max(parseInt(req.query.limit) || 10, 1); // no. of records per page
        const skip = (page - 1) * limit;

        // ================= Base Query =================
        const query = {};

        // ================= Global Search =================
        if (req.query.search?.trim()) {
            const search = req.query.search.trim();

            // search conditions if any field matches
            const searchConditions = [
                { fullName: { $regex: search, $options: "i" } },
                { callingNo: { $regex: search, $options: "i" } },
                { whatsappNo: { $regex: search, $options: "i" } },
                { emailId: { $regex: search, $options: "i" } },
                { occupation: { $regex: search, $options: "i" } },
                { organization: { $regex: search, $options: "i" } },
                { stayType: { $regex: search, $options: "i" } },
            ];
            // Search Current Due from latest rent history
            if (!isNaN(search)) {
                const currentDue = Number(search);

                const dueHistories = await ClientRentHistory.aggregate([
                    {
                        $sort: {
                            year: -1,
                            month: -1,
                            createdAt: -1,
                            _id: -1,
                        },
                    },
                    {
                        $group: {
                            _id: "$clientId",
                            latest: { $first: "$$ROOT" },
                        },
                    },
                    {
                        $match: {
                            "latest.currentDue": currentDue,
                        },
                    },
                ]);

                if (dueHistories.length) {
                    searchConditions.push({
                        _id: {
                            $in: dueHistories.map((item) => item._id),
                        },
                    });
                }
            }
            // Search Property Collection
            const properties = await Property.find({
                $or: [
                    {
                        propertyCode: {
                            $regex: search,
                            $options: "i",
                        },
                    },
                    {
                        propertyLocation: {
                            $regex: search,
                            $options: "i",
                        },
                    },
                ],
            }).select("_id");

            if (properties.length) {
                searchConditions.push({
                    propertyId: {
                        $in: properties.map((p) => p._id),
                    },
                });
            }

            // Search Bed Collection
            const bedQuery = {
                $or: [
                    {
                        roomNo: {
                            $regex: search,
                            $options: "i",
                        },
                    },
                    {
                        bedNo: {
                            $regex: search,
                            $options: "i",
                        },
                    },
                ],
            };

            // Numeric search
            if (!isNaN(search)) {
                const number = Number(search);

                bedQuery.$or.push({ monthlyRent: number }, { depositAmount: number });
            }

            const beds = await Bed.find(bedQuery).select("_id");

            if (beds.length) {
                searchConditions.push({
                    bedId: {
                        $in: beds.map((b) => b._id),
                    },
                });
            }

            // Parking Charges Search
            if (!isNaN(search)) {
                searchConditions.push({
                    parkingCharges: Number(search),
                });
            }

            query.$or = searchConditions;
        }

        // ======================================================
        // PART 2 STARTS HERE
        // (Backend Filters)
        // ======================================================
        // ================= Filters =================

        // Property
        if (req.query.propertyId) {
            query.propertyId = req.query.propertyId;
        }

        // Property Location
        if (req.query.propertyLocation) {
            const properties = await Property.find({
                propertyLocation: req.query.propertyLocation,
            }).select("_id");

            query.propertyId = {
                $in: properties.map((p) => p._id),
            };
        }

        // Stay Type
        if (req.query.stayType) {
            query.stayType = req.query.stayType;
        }

        // ================= F&F Status =================
        if (req.query.fnfStatus === "F&F Closed") {
            query["fnf.status"] = "F&F Closed";
            query.isBookingCancelled = false;
        } else if (req.query.fnfStatus === "Cancelled") {
            query.isBookingCancelled = true;
        } else {
            // Default: hide F&F Closed and cancelled bookings
            query["fnf.status"] = {
                $nin: ["F&F Closed"],
            };
            query.isBookingCancelled = false;
        }

        // Login Enabled
        if (req.query.loginEnabled !== undefined && req.query.loginEnabled !== "") {
            query.loginEnabled = req.query.loginEnabled === "true";
        }

        // Booking Cancelled
        if (
            req.query.isBookingCancelled !== undefined &&
            req.query.isBookingCancelled !== ""
        ) {
            query.isBookingCancelled = req.query.isBookingCancelled === "true";
        } else if (
            req.query.clientStatus !== "Cancelled" &&
            req.query.fnfStatus !== "Cancelled"
        ) {
            query.isBookingCancelled = false;
        }

        if (
            req.query.isBookingCancelled !== undefined &&
            req.query.isBookingCancelled !== ""
        ) {
            query.isBookingCancelled = req.query.isBookingCancelled === "true";
        }

        // Room No
        if (req.query.roomNo) {
            const beds = await Bed.find({
                roomNo: req.query.roomNo,
            }).select("_id");

            query.bedId = {
                $in: beds.map((b) => b._id),
            };
        }

        // Bed No
        if (req.query.bedNo) {
            const beds = await Bed.find({
                bedNo: req.query.bedNo,
            }).select("_id");

            query.bedId = {
                $in: beds.map((b) => b._id),
            };
        }

        // ================= Monthly Rent =================

        if (req.query.monthlyRentMin || req.query.monthlyRentMax) {
            const bedQuery = {};

            bedQuery.monthlyRent = {};

            if (req.query.monthlyRentMin) {
                bedQuery.monthlyRent.$gte = Number(req.query.monthlyRentMin);
            }

            if (req.query.monthlyRentMax) {
                bedQuery.monthlyRent.$lte = Number(req.query.monthlyRentMax);
            }

            const beds = await Bed.find(bedQuery).select("_id");

            query.bedId = {
                $in: beds.map((b) => b._id),
            };
        }

        // ================= Deposit =================

        if (req.query.depositAmountMin || req.query.depositAmountMax) {
            const bedQuery = {};

            bedQuery.depositAmount = {};

            if (req.query.depositAmountMin) {
                bedQuery.depositAmount.$gte = Number(req.query.depositAmountMin);
            }

            if (req.query.depositAmountMax) {
                bedQuery.depositAmount.$lte = Number(req.query.depositAmountMax);
            }

            const beds = await Bed.find(bedQuery).select("_id");

            query.bedId = {
                $in: beds.map((b) => b._id),
            };
        }

        // ================= Parking Charges =================

        if (req.query.parkingChargesMin || req.query.parkingChargesMax) {
            query.parkingCharges = {};

            if (req.query.parkingChargesMin) {
                query.parkingCharges.$gte = Number(req.query.parkingChargesMin);
            }

            if (req.query.parkingChargesMax) {
                query.parkingCharges.$lte = Number(req.query.parkingChargesMax);
            }
        }

        // ================= Client DOJ =================

        if (req.query.clientDojFrom || req.query.clientDojTo) {
            query.clientDoj = {};

            if (req.query.clientDojFrom) {
                query.clientDoj.$gte = req.query.clientDojFrom;
            }

            if (req.query.clientDojTo) {
                query.clientDoj.$lte = req.query.clientDojTo;
            }
        }

        // ================= EB DOJ =================

        if (req.query.ebDojFrom || req.query.ebDojTo) {
            query.ebDoj = {};

            if (req.query.ebDojFrom) {
                query.ebDoj.$gte = req.query.ebDojFrom;
            }

            if (req.query.ebDojTo) {
                query.ebDoj.$lte = req.query.ebDojTo;
            }
        }

        // ================= Notice Start =================

        if (req.query.noticeStartDateFrom || req.query.noticeStartDateTo) {
            query.noticeStartDate = {};

            if (req.query.noticeStartDateFrom) {
                query.noticeStartDate.$gte = req.query.noticeStartDateFrom;
            }

            if (req.query.noticeStartDateTo) {
                query.noticeStartDate.$lte = req.query.noticeStartDateTo;
            }
        }

        // ================= Notice Last =================

        if (req.query.noticeLastDateFrom || req.query.noticeLastDateTo) {
            query.noticeLastDate = {};

            if (req.query.noticeLastDateFrom) {
                query.noticeLastDate.$gte = req.query.noticeLastDateFrom;
            }

            if (req.query.noticeLastDateTo) {
                query.noticeLastDate.$lte = req.query.noticeLastDateTo;
            }
        }

        // ================= Client Vacating =================

        if (req.query.clientVacatingDateFrom || req.query.clientVacatingDateTo) {
            query.clientVacatingDate = {};

            if (req.query.clientVacatingDateFrom) {
                query.clientVacatingDate.$gte = req.query.clientVacatingDateFrom;
            }

            if (req.query.clientVacatingDateTo) {
                query.clientVacatingDate.$lte = req.query.clientVacatingDateTo;
            }
        }

        // ================= Vacation 1 =================

        if (req.query.vacationStartDate1From || req.query.vacationStartDate1To) {
            query.vacationStartDate1 = {};

            if (req.query.vacationStartDate1From) {
                query.vacationStartDate1.$gte = req.query.vacationStartDate1From;
            }

            if (req.query.vacationStartDate1To) {
                query.vacationStartDate1.$lte = req.query.vacationStartDate1To;
            }
        }

        if (req.query.vacationLastDate1From || req.query.vacationLastDate1To) {
            query.vacationLastDate1 = {};

            if (req.query.vacationLastDate1From) {
                query.vacationLastDate1.$gte = req.query.vacationLastDate1From;
            }

            if (req.query.vacationLastDate1To) {
                query.vacationLastDate1.$lte = req.query.vacationLastDate1To;
            }
        }
        // ================= Client Status =================

        // ================= Client Status =================

        if (req.query.clientStatus) {
            const today = new Date().toISOString().split("T")[0];

            switch (req.query.clientStatus) {
                case "Cancelled":
                    query.isBookingCancelled = true;
                    break;

                case "Vacated":
                    query.isBookingCancelled = false;

                    query.clientVacatingDate = {
                        $nin: ["", null],
                        $lte: today,
                    };
                    break;

                case "Notice":
                    query.isBookingCancelled = false;

                    query.noticeStartDate = {
                        $nin: ["", null],
                    };

                    query.$and = [
                        {
                            $or: [
                                { clientVacatingDate: "" },
                                { clientVacatingDate: null },
                                { clientVacatingDate: { $gt: today } },
                            ],
                        },
                    ];
                    break;

                case "Active":
                    query.isBookingCancelled = false;

                    query.$and = [
                        {
                            $or: [
                                { noticeStartDate: "" },
                                { noticeStartDate: null },
                                { noticeStartDate: { $exists: false } },
                            ],
                        },
                        {
                            $or: [
                                { clientVacatingDate: "" },
                                { clientVacatingDate: null },
                                { clientVacatingDate: { $gt: today } },
                            ],
                        },
                    ];
                    break;
            }
        }
        // ================= Vacation 2 =================

        if (req.query.vacationStartDate2From || req.query.vacationStartDate2To) {
            query.vacationStartDate2 = {};

            if (req.query.vacationStartDate2From) {
                query.vacationStartDate2.$gte = req.query.vacationStartDate2From;
            }

            if (req.query.vacationStartDate2To) {
                query.vacationStartDate2.$lte = req.query.vacationStartDate2To;
            }
        }

        if (req.query.vacationLastDate2From || req.query.vacationLastDate2To) {
            query.vacationLastDate2 = {};

            if (req.query.vacationLastDate2From) {
                query.vacationLastDate2.$gte = req.query.vacationLastDate2From;
            }

            if (req.query.vacationLastDate2To) {
                query.vacationLastDate2.$lte = req.query.vacationLastDate2To;
            }
        }
        // ================= Count =================
        // ================= Latest Rent History: Current Due > 0 =================

        const latestRentHistories = await ClientRentHistory.aggregate([
            {
                $sort: {
                    year: -1,
                    month: -1,
                    createdAt: -1,
                },
            },
            {
                $group: {
                    _id: "$clientId",
                    latest: { $first: "$$ROOT" },
                },
            },
            {
                $match: {
                    "latest.currentDue": { $gt: 0 },
                },
            },
        ]);

        const clientsWithDue = latestRentHistories.map((item) => item._id);

        query._id = { $in: clientsWithDue };
        const allMatchingClients = await Client.find(query).select("_id").lean();

        const matchingClientIds = allMatchingClients.map((client) => client._id);

        const totalCurrentDueResult = await ClientRentHistory.aggregate([
            {
                $match: {
                    clientId: { $in: matchingClientIds },
                },
            },
            {
                $sort: {
                    year: -1,
                    month: -1,
                    createdAt: -1,
                    _id: -1,
                },
            },
            {
                $group: {
                    _id: "$clientId",
                    latestRentHistory: { $first: "$$ROOT" },
                },
            },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: {
                            $toDouble: {
                                $ifNull: ["$latestRentHistory.currentDue", 0],
                            },
                        },
                    },
                },
            },
        ]);

        const totalCurrentDue = totalCurrentDueResult[0]?.total || 0;

        const totalRecords = await Client.countDocuments(query);

        // ================= Data =================

        const clients = await Client.find(query)
            .populate("propertyId", "propertyCode propertyName propertyLocation")
            .populate(
                "bedId",
                "bedCode roomNo bedNo monthlyRent depositAmount freeEbAsPerBed acRoom",
            )
            .populate("bedHistory.propertyId", "propertyCode propertyName")
            .populate("bedHistory.bedId", "bedCode roomNo bedNo")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // ==========================================
        // GET VACATION HISTORY FOR CURRENT CLIENTS
        // ==========================================
        const clientIds = clients.map((client) => client._id);

        const rentNotReceivedComments = await RentNotReceivedComment.find({
            clientId: { $in: clientIds },
        }).lean();

        const rentNotReceivedCommentMap = new Map();

        rentNotReceivedComments.forEach((comment) => {
            rentNotReceivedCommentMap.set(comment.clientId.toString(), comment);
        });
        const vacations = await ClientVacationHistory.find({
            clientId: { $in: clientIds },
        }).lean();
        // ==========================================
        // CREATE VACATION MAP
        // ==========================================
        const vacationMap = new Map();

        vacations.forEach((vacation) => {
            const clientId = vacation.clientId.toString();

            if (!vacationMap.has(clientId)) {
                vacationMap.set(clientId, []);
            }

            vacationMap.get(clientId).push(vacation);
        });
        // ==========================================
        // Temporary Client -> Permanent Booking Details
        // ==========================================

        const bookingIds = [
            ...new Set(
                clients
                    .filter(
                        (client) => client.stayType === "T. Booked" && client.bookingId,
                    )
                    .map((client) => client.bookingId.toString()),
            ),
        ];

        const permanentClients = await Client.find({
            bookingId: { $in: bookingIds },
            stayType: "P. Booked",
            isBookingCancelled: false,
        })
            .populate("propertyId", "propertyCode propertyName propertyLocation")
            .populate("bedId", "bedCode roomNo bedNo monthlyRent depositAmount")
            .lean();

        const permanentMap = new Map();

        permanentClients.forEach((permanent) => {
            permanentMap.set(permanent.bookingId?.toString(), permanent);
        });

        const responseClients = clients.map((client) => {
            const data = client.toObject();
            const rentNotReceivedComment = rentNotReceivedCommentMap.get(
                client._id.toString(),
            ) || {
                _id: null,
                comments: [],
            };

            data.rentNotReceivedComment = rentNotReceivedComment;
            // ==========================================
            // VACATION DATA
            // ==========================================
            const vacations = vacationMap.get(client._id.toString()) || [];

            data.vacations = vacations.map((vacation) => ({
                _id: vacation._id,
                month: vacation.month,
                year: vacation.year,
                vacationStartDate1: vacation.vacationStartDate1 || null,
                vacationLastDate1: vacation.vacationLastDate1 || null,
                vacationStartDate2: vacation.vacationStartDate2 || null,
                vacationLastDate2: vacation.vacationLastDate2 || null,
                vacationComments: vacation.vacationComments || [],
            }));

            if (client.stayType === "T. Booked" && client.bookingId) {
                const permanent = permanentMap.get(client.bookingId.toString());

                data.permanentBooking = permanent
                    ? {
                        clientId: permanent._id,

                        propertyId: permanent.propertyId?._id,
                        propertyCode: permanent.propertyId?.propertyCode,
                        propertyName: permanent.propertyId?.propertyName,
                        propertyLocation: permanent.propertyId?.propertyLocation,

                        bedId: permanent.bedId?._id,
                        bedCode: permanent.bedId?.bedCode,
                        roomNo: permanent.bedId?.roomNo,
                        bedNo: permanent.bedId?.bedNo,

                        monthlyRent: permanent.monthlyRent,
                        depositAmount: permanent.depositAmount,
                    }
                    : null;
            }

            return data;
        });

        return res.status(200).json({
            success: true,
            page,
            limit,
            totalRecords,
            totalPages: Math.ceil(totalRecords / limit),
            hasNextPage: page < Math.ceil(totalRecords / limit),
            hasPrevPage: page > 1,
            count: clients.length,
            data: responseClients,
            totalCurrentDue,
        });
    } catch (error) {
        console.error("Get Clients Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};