const ImageKit = require("imagekit");
const { logger } = require("../utils/logger");

// Initialize ImageKit
const imagekit = new ImageKit({
	publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "public_Z7KlDf6LNJ4XovU3aImnKQUaapA=",
	privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "private_BYTCEok3JURyuOplv/La/1UC77A=",
	urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/9vpn8u272",
});

const imageKitService = {
	/**
	 * List files in a specific folder
	 * Used for retrieving verification images
	 */
	listFiles: async (path) => {
		try {
			const result = await imagekit.listFiles({
				path: path,
			});
			return result;
		} catch (error) {
			logger.error("ImageKit listFiles failed", { err: error });
			throw error;
		}
	},

	/**
	 * Get file details by ID
	 */
	getFileDetails: async (fileId) => {
		try {
			const result = await imagekit.getFileDetails(fileId);
			return result;
		} catch (error) {
			logger.error("ImageKit getFileDetails failed", { err: error });
			throw error;
		}
	},

	/**
	 * Search files by path to find fileId
	 */
	searchFiles: async (path) => {
		try {
			const result = await imagekit.listFiles({
				path: path,
			});
			return result;
		} catch (error) {
			logger.error("ImageKit searchFiles failed", { err: error });
			throw error;
		}
	},

	/**
	 * Upload a file to ImageKit
	 */
	uploadFile: async (file, fileName, folder, tags = []) => {
		try {
			const result = await imagekit.upload({
				file: file, // buffer or base64 string
				fileName: fileName,
				folder: folder,
				tags: tags,
				useUniqueFileName: false, // Keep consistent naming
				transformation: {
					pre: 'q-80,w-256,h-256,fo-auto', // Quality 80, max 256x256, auto format
				},
			});
			return result;
		} catch (error) {
			logger.error("ImageKit uploadFile failed", { err: error });
			throw error;
		}
	},

	/**
	 * Upload a wide banner/advertisement image (keeps aspect ratio, caps width).
	 * Unlike uploadFile (which force-crops to 256x256 for icons), this is sized
	 * for full-width promo banners.
	 */
	uploadBanner: async (file, fileName, folder = 'advertisements', tags = []) => {
		try {
			const result = await imagekit.upload({
				file, // buffer or base64 string
				fileName,
				folder,
				tags,
				useUniqueFileName: true,
				transformation: {
					pre: 'q-80,w-1080', // quality 80, cap width at 1080px, keep aspect ratio
				},
			});
			return result;
		} catch (error) {
			logger.error("ImageKit uploadBanner failed", { err: error });
			throw error;
		}
	},

	/**
	 * Delete a file
	 */
	deleteFile: async (fileId) => {
		try {
			await imagekit.deleteFile(fileId);
			return true;
		} catch (error) {
			logger.error("ImageKit deleteFile failed", { err: error });
			return false;
		}
	},

	/**
	 * Rename a file in place (keeps it in the same folder, same image content)
	 * @param {string} filePath - full current path, e.g. /professionIconsUpload/plumber.webp
	 * @param {string} newFileName - new filename only (no path), e.g. pipe-fitter.webp
	 * @param {boolean} purgeCache - purge the CDN cache for the old URL
	 */
	renameFile: async (filePath, newFileName, purgeCache = true) => {
		try {
			const result = await imagekit.renameFile({
				filePath,
				newFileName,
				purgeCache,
			});
			return result;
		} catch (error) {
			logger.error("ImageKit renameFile failed", { err: error });
			throw error;
		}
	},
};

module.exports = imageKitService;
