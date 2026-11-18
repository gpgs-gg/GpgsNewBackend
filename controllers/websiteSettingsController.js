const WebsiteSettings = require("../models/WebsiteSettings.model");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");

// ========================================
// GET ACTIVE HERO VIDEO
// ========================================

exports.getHeroVideo = async (req, res) => {
  try {
    const settings = await WebsiteSettings.findOne({
      key: "heroVideo",
    }).lean();

    return res.status(200).json({
      success: true,
      videoUrl: settings?.videoUrl || null,
      updatedAt: settings?.updatedAt || null,
    });
  } catch (error) {
    console.error("Get Hero Video Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch hero video.",
    });
  }
};

// ========================================
// UPLOAD / REPLACE HERO VIDEO
// ========================================

exports.updateHeroVideo = async (req, res) => {
  let uploadedAsset = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a video.",
      });
    }

    // Get existing video
    const existingSettings = await WebsiteSettings.findOne({
      key: "heroVideo",
    });

    // Upload new video to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "gpgs/website/hero",
          format: "mp4",
          transformation: [
            {
              quality: "auto",
              fetch_format: "auto",
            },
          ],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      Readable.from(req.file.buffer).pipe(stream);
    });

    uploadedAsset = uploadResult;

    if (!uploadResult?.secure_url || !uploadResult?.public_id) {
      throw new Error("Cloudinary upload did not return a valid asset.");
    }

    // Save new video in MongoDB
    const settings = await WebsiteSettings.findOneAndUpdate(
      { key: "heroVideo" },
      {
        $set: {
          videoUrl: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          format: uploadResult.format || "mp4",
          updatedBy: req.user?.name || req.user?.email || "Admin",
        },
        $setOnInsert: {
          key: "heroVideo",
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    );

    // Delete old video only after successful DB update
    if (
      existingSettings?.publicId &&
      existingSettings.publicId !== uploadResult.public_id
    ) {
      try {
        await cloudinary.uploader.destroy(existingSettings.publicId, {
          resource_type: "video",
          invalidate: true,
        });
      } catch (deleteError) {
        console.error("Old Hero Video Cleanup Failed:", deleteError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Hero video updated successfully.",
      videoUrl: settings.videoUrl,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.error("Update Hero Video Error:", error);

    // Clean up newly uploaded asset if DB update fails
    if (uploadedAsset?.public_id) {
      try {
        await cloudinary.uploader.destroy(uploadedAsset.public_id, {
          resource_type: "video",
        });
      } catch (cleanupError) {
        console.error("New Video Cleanup Failed:", cleanupError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update hero video.",
      error: error.message,
    });
  }
};