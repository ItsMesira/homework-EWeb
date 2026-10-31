// server/integrations/cloudinary.js — Cloudinary upload and signed URL helper
//
// Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
// When CLOUDINARY_ENABLED is false, all operations return a graceful null
// so routes can respond with 503 instead of crashing.

const {
  CLOUDINARY_ENABLED,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = require('../../config');

let cloudinary = null;

function getCloudinary() {
  if (!CLOUDINARY_ENABLED) return null;
  if (cloudinary) return cloudinary;

  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key:    CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure:     true,
  });
  return cloudinary;
}

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer
 * @param {object} opts — { folder, resourceType, publicId }
 * @returns {Promise<{ publicId, secureUrl, resourceType, format, bytes }>}
 */
async function uploadBuffer(buffer, opts = {}) {
  const cld = getCloudinary();
  if (!cld) throw new Error('Cloudinary is not configured');

  return new Promise((resolve, reject) => {
    const uploadStream = cld.uploader.upload_stream(
      {
        folder:       opts.folder || 'emble/attachments',
        resource_type: opts.resourceType || 'auto',
        public_id:    opts.publicId,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          publicId:     result.public_id,
          secureUrl:    result.secure_url,
          resourceType: result.resource_type,
          format:       result.format,
          bytes:        result.bytes,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Generate a signed URL for private delivery (expires in 1 hour).
 * @param {string} publicId — Cloudinary public ID
 * @returns {string} signed URL or null if not configured
 */
function signedUrl(publicId) {
  const cld = getCloudinary();
  if (!cld || !publicId) return null;
  return cld.utils.private_download_url(publicId, 'jpg', {
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });
}

/**
 * Delete an asset from Cloudinary.
 * @param {string} publicId
 * @returns {Promise<boolean>}
 */
async function deleteAsset(publicId) {
  const cld = getCloudinary();
  if (!cld || !publicId) return false;
  await cld.uploader.destroy(publicId);
  return true;
}

module.exports = {
  isConfigured: CLOUDINARY_ENABLED,
  getCloudinary,
  uploadBuffer,
  signedUrl,
  deleteAsset,
};
