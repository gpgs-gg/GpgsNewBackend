const { uploadToCloudinary } = require("../utils/uploadToCloudinary");

const uploadFile = async (file, folder) => {
  if (!file) return null;

  const isPdf = file.mimetype === "application/pdf";

  const uploaded = await uploadToCloudinary(
    file.buffer,
    folder,
    isPdf
  );

  return uploaded?.secure_url || null;
};

module.exports = uploadFile;