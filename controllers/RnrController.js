const Client = require("../models/client.model");
const RentNotReceivedComment = require("../models/rentNotReceivedComment.model");
const PropertySequence = require("../models/propertySequence.model");
const Property = require("../models/property.model");
const mongoose = require("mongoose");
exports.getAllRNRClients = async (req, res) => {
  try {
    // ================= Pagination =================
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    // ================= Base Query =================
    const query = {};

    // ================= Global Search =================
    if (req.query.search?.trim()) {
      const search = req.query.search.trim();
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escapedSearch, "i");

      const properties = await Property.find({
        propertyCode: regex,
      })
        .select("_id")
        .lean();

      const propertyIds = properties.map((p) => p._id);

      query.$or = [
        { fullName: regex },
        { callingNo: regex },
        { whatsappNo: regex },
        { emailId: regex },
        { narration: regex },
        { propertyId: { $in: propertyIds } },
      ];
      // Search by Latest Rent History Current Due
      const dueAmount = Number(search);

      if (search !== "" && Number.isFinite(dueAmount)) {
        query.$or.push({
          "latestRentHistory.currentDue": dueAmount,
        });
      }
    }
    // ================= Filters =================
    if (req.query.rentStatus) query.rentStatus = req.query.rentStatus;
    if (req.query.propertyId?.trim()) {
      if (!mongoose.Types.ObjectId.isValid(req.query.propertyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid propertyId",
        });
      }

      query.propertyId = new mongoose.Types.ObjectId(
        req.query.propertyId.trim(),
      );
    }

    if (req.query.bedId) query.bedId = req.query.bedId;
    if (req.query.clientId) query.clientId = req.query.clientId;

    if (req.query.fromDate || req.query.toDate) {
      query.createdAt = {};
      if (req.query.fromDate)
        query.createdAt.$gte = new Date(req.query.fromDate);
      if (req.query.toDate) {
        const to = new Date(req.query.toDate);
        to.setHours(23, 59, 59, 999);
        query.createdAt.$lte = to;
      }
    }

    // ================= Sorting =================
    const sortField = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const sort = { [sortField]: sortOrder };

    // ================= Total Current Due =================

    // ================= Property Sequence =================
    const propertySequences = await PropertySequence.find()
      .sort({ sequence: 1 })
      .select("propertyCode sequence")
      .lean();

    const propertyOrderMap = {};

    propertySequences.forEach((item) => {
      propertyOrderMap[item.propertyCode.trim()] = item.sequence;
    });

    // ================= Fetch =================
    const [data, totalRecords] = await Promise.all([
      Client.aggregate([
        { $match: query },

        {
          $lookup: {
            from: "properties",
            localField: "propertyId",
            foreignField: "_id",
            as: "property",
          },
        },

        {
          $unwind: {
            path: "$property",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $addFields: {
            propertySequence: {
              $ifNull: [
                {
                  $getField: {
                    field: {
                      $ifNull: ["$property.propertyCode", ""],
                    },
                    input: { $literal: propertyOrderMap },
                  },
                },
                999999999,
              ],
            },
          },
        },

        {
          $sort: {
            propertySequence: 1,
            [sortField]: sortOrder,
            _id: 1,
          },
        },

        { $skip: skip },
        { $limit: limit },

        {
          $lookup: {
            from: "beds",
            localField: "bedId",
            foreignField: "_id",
            as: "bed",
          },
        },

        {
          $unwind: {
            path: "$bed",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $addFields: {
            propertyId: {
              $cond: [
                { $ifNull: ["$property._id", false] },
                {
                  _id: "$property._id",
                  propertyCode: "$property.propertyCode",
                },
                null,
              ],
            },
            bedId: {
              $cond: [
                { $ifNull: ["$bed._id", false] },
                {
                  _id: "$bed._id",
                  bedNo: "$bed.bedNo",
                  roomNo: "$bed.roomNo",
                },
                null,
              ],
            },
          },
        },

        { $project: { property: 0, bed: 0, propertySequence: 0 } },
      ]),

      Client.countDocuments(query),
    ]);

    // ================= Total Current Due =================
    const totalCurrentDueResult = await Client.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $convert: {
                input: "$latestRentHistory.currentDue",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ]);

    const totalCurrentDue = totalCurrentDueResult[0]?.total || 0;

    // ================= Attach Comments =================
    const clientIds = data.map((item) => item._id);

    const comments = await RentNotReceivedComment.find({
      clientId: { $in: clientIds },
    })
      .sort({ createdAt: -1 })
      .lean();

    const commentsByClient = comments.reduce((acc, c) => {
      const key = String(c.clientId);

      if (!acc[key]) acc[key] = [];
      acc[key].push(c);

      return acc;
    }, {});

    const enrichedData = data.map((item) => ({
      ...item,
      rentNotReceivedComment: commentsByClient[String(item._id)] || [],
    }));

    // ================= Response =================
    const totalPages = Math.ceil(totalRecords / limit);

    return res.status(200).json({
      success: true,
      message: "Rent-not-received clients fetched successfully",
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      count: enrichedData.length,
      totalCurrentDue,
      data: enrichedData,
    });
  } catch (error) {
    console.error("getAllRNRClients error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch rent-not-received clients",
      error: error.message,
    });
  }
};
