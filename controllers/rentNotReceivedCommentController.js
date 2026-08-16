const RentNotReceivedComment = require("../models/rentNotReceivedComment.model");
const Client = require("../models/client.model");

exports.addRentNotReceivedComment = async (req, res) => {
  try {
    const { clientId, comment } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required",
      });
    }

    if (!comment?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment is required",
      });
    }

    // =========================
    // FIND CLIENT
    // =========================
    const client = await Client.findById(clientId)
      .select("_id propertyId bedId fullName");

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    if (!client.propertyId) {
      return res.status(400).json({
        success: false,
        message: "Client property is not assigned",
      });
    }

    if (!client.bedId) {
      return res.status(400).json({
        success: false,
        message: "Client bed is not assigned",
      });
    }

    // =========================
    // FIND EXISTING COMMENT DOC
    // =========================
    let rentNotReceived = await RentNotReceivedComment.findOne({
      clientId: client._id,
    });

    // =========================
    // APPEND COMMENT
    // =========================
    if (rentNotReceived) {
      rentNotReceived.comments.push({
        comment: comment.trim(),
        date: new Date(),
        addedBy: req.user?._id || null,
      });

      // Agar client ka bed/property change hua ho
      rentNotReceived.propertyId = client.propertyId;
      rentNotReceived.bedId = client.bedId;

      await rentNotReceived.save();

      return res.status(200).json({
        success: true,
        message: "Comment added successfully",
        data: rentNotReceived,
      });
    }

    // =========================
    // CREATE FIRST COMMENT
    // =========================
    rentNotReceived =
      await RentNotReceivedComment.create({
        clientId: client._id,
        propertyId: client.propertyId,
        bedId: client.bedId,

        comments: [
          {
            comment: comment.trim(),
            date: new Date(),
            addedBy: req.user?._id || null,
          },
        ],
      });

    return res.status(201).json({
      success: true,
      message: "Rent not received comment added successfully",
      data: rentNotReceived,
    });
  } catch (error) {
    console.error(
      "Add Rent Not Received Comment Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};





























// const RentNotReceivedComment = require("../models/rentNotReceivedComment.model");
// const Client = require("../models/client.model");
// const mongoose = require("mongoose");

// // ============================================================
// // ADD RNR COMMENT
// // ============================================================

// exports.addRentNotReceivedComment = async (req, res) => {
//   try {
//     const { clientId, comment } = req.body;

//     if (!clientId) {
//       return res.status(400).json({
//         success: false,
//         message: "Client ID is required",
//       });
//     }

//     if (!mongoose.Types.ObjectId.isValid(clientId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid client ID",
//       });
//     }

//     if (!comment || !comment.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: "Comment is required",
//       });
//     }

//     // ========================================================
//     // CHECK CLIENT
//     // ========================================================

//     const client = await Client.findById(clientId);

//     if (!client) {
//       return res.status(404).json({
//         success: false,
//         message: "Client not found",
//       });
//     }

//     // ========================================================
//     // FIND EXISTING RNR
//     // ========================================================

//     let rnr = await RentNotReceivedComment.findOne({
//       clientId,
//     });

//     // ========================================================
//     // ADD COMMENT TO EXISTING RNR
//     // ========================================================

//     if (rnr) {
//       rnr.comments.push({
//         comment: comment.trim(),
//         date: new Date(),
//         addedBy: req.user?._id || null,
//       });

//       // Latest client information update
//       rnr.propertyId = client.propertyId;
//       rnr.bedId = client.bedId;

//       await rnr.save();

//       return res.status(200).json({
//         success: true,
//         message: "Rent not received comment added successfully",
//         data: rnr,
//       });
//     }

//     // ========================================================
//     // CREATE FIRST RNR
//     // ========================================================

//     rnr = await RentNotReceivedComment.create({
//       clientId: client._id,

//       propertyId: client.propertyId,

//       bedId: client.bedId,

//       comments: [
//         {
//           comment: comment.trim(),
//           date: new Date(),
//           addedBy: req.user?._id || null,
//         },
//       ],
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Rent not received created successfully",
//       data: rnr,
//     });
//   } catch (error) {
//     console.error(
//       "Add Rent Not Received Comment Error:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // ============================================================
// // GET CLIENT RNR
// // ============================================================

// exports.getRentNotReceivedByClient = async (req, res) => {
//   try {
//     const { clientId } = req.params;

//     if (!clientId) {
//       return res.status(400).json({
//         success: false,
//         message: "Client ID is required",
//       });
//     }

//     if (!mongoose.Types.ObjectId.isValid(clientId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid client ID",
//       });
//     }

//     const rnr = await RentNotReceivedComment.findOne({
//       clientId,
//     })
//       .populate(
//         "clientId",
//         "fullName emailId callingNo whatsappNo"
//       )
//       .populate(
//         "propertyId",
//         "propertyCode propertyName"
//       )
//       .populate(
//         "bedId",
//         "roomNo bedNo"
//       )
//       .populate(
//         "comments.addedBy",
//         "name email role"
//       )
//       .lean();

//     // RNR record nahi hai
//     if (!rnr) {
//       return res.status(200).json({
//         success: true,
//         message: "No rent not received record found",
//         data: null,
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       data: rnr,
//     });
//   } catch (error) {
//     console.error(
//       "Get Rent Not Received Error:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // ============================================================
// // GET ALL RNR CLIENTS
// // ============================================================

// exports.getAllRentNotReceived = async (req, res) => {
//   try {
//     const rnr = await RentNotReceivedComment.find({})
//       .populate(
//         "clientId",
//         "fullName emailId callingNo whatsappNo clientDoj"
//       )
//       .populate(
//         "propertyId",
//         "propertyCode propertyName"
//       )
//       .populate(
//         "bedId",
//         "roomNo bedNo"
//       )
//       .populate(
//         "comments.addedBy",
//         "name email role"
//       )
//       .sort({
//         updatedAt: -1,
//       })
//       .lean();

//     return res.status(200).json({
//       success: true,
//       count: rnr.length,
//       data: rnr,
//     });
//   } catch (error) {
//     console.error(
//       "Get All Rent Not Received Error:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // ============================================================
// // UPDATE PARTICULAR COMMENT
// // ============================================================

// exports.updateRentNotReceivedComment = async (
//   req,
//   res
// ) => {
//   try {
//     const { rnrId, commentId } = req.params;
//     const { comment } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(rnrId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid RNR ID",
//       });
//     }

//     if (!mongoose.Types.ObjectId.isValid(commentId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid comment ID",
//       });
//     }

//     if (!comment || !comment.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: "Comment is required",
//       });
//     }

//     const rnr = await RentNotReceivedComment.findById(
//       rnrId
//     );

//     if (!rnr) {
//       return res.status(404).json({
//         success: false,
//         message: "Rent not received record not found",
//       });
//     }

//     const commentData = rnr.comments.id(commentId);

//     if (!commentData) {
//       return res.status(404).json({
//         success: false,
//         message: "Comment not found",
//       });
//     }

//     commentData.comment = comment.trim();

//     await rnr.save();

//     return res.status(200).json({
//       success: true,
//       message: "Comment updated successfully",
//       data: rnr,
//     });
//   } catch (error) {
//     console.error(
//       "Update RNR Comment Error:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // ============================================================
// // DELETE PARTICULAR COMMENT
// // ============================================================

// exports.deleteRentNotReceivedComment = async (
//   req,
//   res
// ) => {
//   try {
//     const { rnrId, commentId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(rnrId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid RNR ID",
//       });
//     }

//     const rnr = await RentNotReceivedComment.findById(
//       rnrId
//     );

//     if (!rnr) {
//       return res.status(404).json({
//         success: false,
//         message: "Rent not received record not found",
//       });
//     }

//     const commentData = rnr.comments.id(commentId);

//     if (!commentData) {
//       return res.status(404).json({
//         success: false,
//         message: "Comment not found",
//       });
//     }

//     commentData.deleteOne();

//     await rnr.save();

//     return res.status(200).json({
//       success: true,
//       message: "Comment deleted successfully",
//       data: rnr,
//     });
//   } catch (error) {
//     console.error(
//       "Delete RNR Comment Error:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };