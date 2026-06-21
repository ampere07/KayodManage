const JobCategory = require('../models/JobCategory');
const Job = require('../models/Job');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const imageKitService = require('../services/imageKitService');

const KAYOD_PROFESSIONS_DIR = path.join(__dirname, '../../../..', 'kayod/client/src/assets/icons/professions');
const MANAGE_PROFESSIONS_DIR = path.join(__dirname, '../../..', 'Frontend/public/assets/icons/professions');

// Must stay in lockstep with the Kayod client's profession-icon resolver
// (kayod/client: JobCard.jsx & categoryVisualMapping.js), which builds
// professionIconsUpload/<slug>.webp from the profession NAME. If these diverge the
// client requests a filename the stored icon doesn't have and the icon 404s.
const generateIconFilename = (professionName) => {
  return generateIconSlug(professionName) + '.webp';
};

const generateIconSlug = (professionName) => {
  return professionName
    .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase → kebab (parity with Kayod client)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
};

// Get socket.io instance
let io;
try {
  io = require('../../server').getIO();
} catch (err) {
  console.warn('Socket.io not available for real-time updates');
}

// Job Categories
exports.getJobCategories = async (req, res) => {
  try {
    const categories = await JobCategory.find().sort({ name: 1 }).lean();

    res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error('Error fetching job categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job categories',
      error: error.message,
    });
  }
};

exports.createJobCategory = async (req, res) => {
  try {
    const { name, icon, professions } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    const existingCategory = await JobCategory.findOne({
      name: name.trim()
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists',
      });
    }

    // Create the category first
    const category = await JobCategory.create({
      name: name.trim(),
      icon: icon || undefined,
      professions: [],
    });

    // If professions were provided, create them
    if (professions && Array.isArray(professions)) {
      for (const professionData of professions) {
        if (professionData.name && professionData.name.trim()) {
          const existingProfession = category.professions.find(
            p => p.name.toLowerCase() === professionData.name.trim().toLowerCase()
          );

          if (!existingProfession) {
            category.professions.push({
              name: professionData.name.trim(),
              icon: professionData.icon || undefined,
            });
          }
        }
      }

      // Save the category with professions
      await category.save();
    }

    res.status(201).json({
      success: true,
      category,
    });
  } catch (error) {
    console.error('Error creating job category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create job category',
      error: error.message,
    });
  }
};

exports.updateJobCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, icon } = req.body;

    const category = await JobCategory.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Category name is required',
        });
      }

      const existingCategory = await JobCategory.findOne({
        name: name.trim(),
        _id: { $ne: categoryId },
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category name already exists',
        });
      }

      category.name = name.trim();
    }

    if (icon !== undefined) {
      category.icon = icon;
    }

    await category.save();

    res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    console.error('Error updating job category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job category',
      error: error.message,
    });
  }
};

exports.deleteJobCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await JobCategory.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Category and associated professions deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting job category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete job category',
      error: error.message,
    });
  }
};

// Professions
exports.createProfession = async (req, res) => {
  try {
    const { name, categoryId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Profession name is required',
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required',
      });
    }

    const category = await JobCategory.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const existingProfession = category.professions.find(
      p => p.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (existingProfession) {
      return res.status(400).json({
        success: false,
        message: 'Profession already exists in this category',
      });
    }

    category.professions.push({
      name: name.trim(),
    });

    await category.save();

    const newProfession = category.professions[category.professions.length - 1];

    res.status(201).json({
      success: true,
      profession: newProfession,
    });
  } catch (error) {
    console.error('Error creating profession:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create profession',
      error: error.message,
    });
  }
};

exports.updateProfession = async (req, res) => {
  try {
    const { professionId } = req.params;
    const { name, icon, isQuickAccess, quickAccessOrder } = req.body;

    const category = await JobCategory.findOne({
      'professions._id': professionId,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Profession not found',
      });
    }

    const profession = category.professions.id(professionId);

    if (!profession) {
      return res.status(404).json({
        success: false,
        message: 'Profession not found',
      });
    }

    // Capture old values before updating
    const oldName = profession.name;
    const oldIcon = profession.icon;

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Profession name is required',
        });
      }

      const existingProfession = category.professions.find(
        p => p._id.toString() !== professionId &&
          p.name.toLowerCase() === name.trim().toLowerCase()
      );

      if (existingProfession) {
        return res.status(400).json({
          success: false,
          message: 'Profession name already exists in this category',
        });
      }

      profession.name = name.trim();
    }

    if (icon !== undefined) {
      profession.icon = icon;
    }

    if (isQuickAccess !== undefined) {
      profession.isQuickAccess = isQuickAccess;
    }

    if (quickAccessOrder !== undefined) {
      profession.quickAccessOrder = quickAccessOrder;
    }

    // When a profession is renamed and its icon already lives in ImageKit (and no new
    // icon is being uploaded in this same request), rename the ImageKit file so its name
    // stays in sync with the profession. The Kayod client resolves profession icons by
    // building professionIconsUpload/<slug>.webp from the profession NAME, so the stored
    // file MUST match the new name or the icon 404s. Only the filename/URL changes — the
    // image content is untouched — so the profession keeps using the same icon.
    let renamedIkIcon = null;
    let ikRollback = null;
    const requestIconChanged = icon !== undefined && icon !== oldIcon;
    const professionRenamed = name !== undefined && name.trim() !== oldName;

    if (professionRenamed && !requestIconChanged && oldIcon && oldIcon.startsWith('ik:')) {
      const oldFilePath = oldIcon.replace('ik:', '');
      const normalizedPath = oldFilePath.startsWith('/') ? oldFilePath : `/${oldFilePath}`;
      const oldFileName = normalizedPath.split('/').pop();
      const folderPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
      // Keep the original extension (legacy ImageKit icons may be .png, new ones are .webp)
      const oldExt = oldFileName.includes('.') ? oldFileName.slice(oldFileName.lastIndexOf('.')) : '.webp';
      const newBaseName = generateIconSlug(name.trim());
      const newFileName = `${newBaseName}${oldExt}`;

      // Skip if the new name sanitizes to nothing (symbol-only / non-Latin), which would
      // produce a degenerate ".webp" filename that collides across professions.
      if (newBaseName && oldFileName !== newFileName) {
        try {
          await imageKitService.renameFile(normalizedPath, newFileName, true);
          renamedIkIcon = `ik:${folderPath}/${newFileName}`;
          profession.icon = renamedIkIcon;
          // Compensating action: if the DB write below fails, rename the file back so the
          // stored icon path and the actual ImageKit file never drift apart.
          ikRollback = () => imageKitService.renameFile(`${folderPath}/${newFileName}`, oldFileName, true);
          console.log(`[Configurations] ImageKit profession icon renamed: "${oldFileName}" → "${newFileName}"`);
        } catch (ikErr) {
          // e.g. a file with the new name already exists, or a transient API error.
          // Keep the existing icon reference so the profession still shows its icon.
          console.warn(`[Configurations] Could not rename ImageKit profession icon: ${ikErr.message}`);
        }
      }
    }

    profession.updatedAt = new Date();

    try {
      await category.save();
    } catch (saveErr) {
      // The ImageKit file was already renamed but persisting the profession failed — roll
      // the file back so the stored icon path and the actual ImageKit file stay consistent.
      if (ikRollback) {
        try {
          await ikRollback();
          console.warn('[Configurations] Rolled back ImageKit rename after profession save failure');
        } catch (rbErr) {
          console.error(`[Configurations] ImageKit rename rollback FAILED: ${rbErr.message}`);
        }
      }
      throw saveErr;
    }

    // Cascade profession name and icon changes to existing Job and Draft documents
    const warnings = [];
    const nameChanged = name && name.trim() !== oldName;
    const iconChanged = requestIconChanged || !!renamedIkIcon;

    if (nameChanged || iconChanged) {
      const update = {};

      if (nameChanged) {
        update.professionName = name.trim();
      }
      if (renamedIkIcon) {
        // ImageKit file was renamed — point existing jobs/drafts at the new path.
        update.icon = renamedIkIcon;
      } else if (requestIconChanged) {
        if (icon.startsWith('ik:')) {
          update.icon = icon;
        } else {
          update.icon = icon.startsWith('custom:') ? icon : `custom:${icon}`;
        }
      }

      // Handle icon files on disk (only for legacy custom icons)
      if (requestIconChanged && !icon.startsWith('ik:') && !oldIcon?.startsWith('ik:')) {
        // Derive old filename from DB icon field, or fall back to generating from old profession name
        const oldFileName = oldIcon
          ? (oldIcon.startsWith('custom:') ? oldIcon.replace('custom:', '') : oldIcon)
          : generateIconFilename(oldName);
        const newFileName = icon.startsWith('custom:') ? icon.replace('custom:', '') : icon;

        if (oldFileName !== newFileName) {
          // COPY in kayod client (preserves static imports, adds new filename for URL serving)
          try {
            const oldPath = path.join(KAYOD_PROFESSIONS_DIR, oldFileName);
            const newPath = path.join(KAYOD_PROFESSIONS_DIR, newFileName);
            if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
              fs.copyFileSync(oldPath, newPath);
              console.log(`[Configurations] Icon file copied: "${oldFileName}" → "${newFileName}" in kayod client`);
            }
          } catch (fileErr) {
            console.warn(`[Configurations] Could not copy icon file in kayod client: ${fileErr.message}`);
          }

          // RENAME in KayodManage (no static imports, safe to rename)
          try {
            const oldPath = path.join(MANAGE_PROFESSIONS_DIR, oldFileName);
            const newPath = path.join(MANAGE_PROFESSIONS_DIR, newFileName);
            if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
              fs.renameSync(oldPath, newPath);
              console.log(`[Configurations] Icon file renamed: "${oldFileName}" → "${newFileName}" in KayodManage`);
            }
          } catch (fileErr) {
            console.warn(`[Configurations] Could not rename icon file in KayodManage: ${fileErr.message}`);
          }
        }
      }

      // Update Jobs with old profession name
      const jobQuery = { professionName: oldName };
      try {
        const jobResult = await Job.updateMany(jobQuery, { $set: update });
        console.log(`[Configurations] Updated ${jobResult.modifiedCount} jobs.`);
      } catch (jobErr) {
        console.warn(`[Configurations] Could not update jobs: ${jobErr.message}`);
        // Surface the partial cascade so the admin knows existing jobs may still point at
        // the old icon path (which no longer exists after the ImageKit rename).
        warnings.push(`Failed to update some jobs to the renamed icon: ${jobErr.message}`);
      }

      // Update Drafts with old profession name (no Draft model, use raw collection)
      try {
        const draftsCollection = mongoose.connection.collection('drafts');
        const draftResult = await draftsCollection.updateMany(
          { professionName: oldName },
          { $set: update }
        );
        console.log(`[Configurations] Updated ${draftResult.modifiedCount} drafts.`);
      } catch (draftErr) {
        console.warn(`[Configurations] Could not update drafts: ${draftErr.message}`);
        warnings.push(`Failed to update some drafts to the renamed icon: ${draftErr.message}`);
      }

      console.log(
        `[Configurations] Profession renamed: "${oldName}" → "${name ? name.trim() : oldName}". `
      );
    }

    // Emit socket event for real-time update
    if (io) {
      try {
        const adminNamespace = io.of('/admin');
        adminNamespace.emit('configuration:updated', {
          type: 'profession',
          action: 'updated',
          professionId,
          profession,
        });
      } catch (socketErr) {
        console.error('Error emitting socket event:', socketErr);
      }
    }

    res.status(200).json({
      success: true,
      profession,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (error) {
    console.error('Error updating profession:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profession',
      error: error.message,
    });
  }
};

exports.deleteProfession = async (req, res) => {
  try {
    const { professionId } = req.params;

    const category = await JobCategory.findOne({
      'professions._id': professionId,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Profession not found',
      });
    }

    category.professions.pull(professionId);
    await category.save();

    // Emit socket event for real-time update
    if (io) {
      try {
        const adminNamespace = io.of('/admin');
        adminNamespace.emit('configuration:updated', {
          type: 'profession',
          action: 'deleted',
          professionId,
        });
      } catch (socketErr) {
        console.error('Error emitting socket event:', socketErr);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Profession deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting profession:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profession',
      error: error.message,
    });
  }
};

// Transfer profession to another category
exports.transferProfession = async (req, res) => {
  try {
    const { professionId } = req.params;
    const { targetCategoryId } = req.body;

    if (!targetCategoryId) {
      return res.status(400).json({
        success: false,
        message: 'Target category ID is required',
      });
    }

    // Find the source category containing the profession
    const sourceCategory = await JobCategory.findOne({
      'professions._id': professionId,
    });

    if (!sourceCategory) {
      return res.status(404).json({
        success: false,
        message: 'Profession not found',
      });
    }

    // Prevent transferring to the same category
    if (sourceCategory._id.toString() === targetCategoryId) {
      return res.status(400).json({
        success: false,
        message: 'Profession is already in this category',
      });
    }

    // Find the target category
    const targetCategory = await JobCategory.findById(targetCategoryId);

    if (!targetCategory) {
      return res.status(404).json({
        success: false,
        message: 'Target category not found',
      });
    }

    // Get the profession data
    const profession = sourceCategory.professions.id(professionId);

    if (!profession) {
      return res.status(404).json({
        success: false,
        message: 'Profession not found in source category',
      });
    }

    // Check if a profession with the same name already exists in the target category
    const existingProfession = targetCategory.professions.find(
      p => p.name.toLowerCase() === profession.name.toLowerCase()
    );

    if (existingProfession) {
      return res.status(400).json({
        success: false,
        message: `A profession named "${profession.name}" already exists in "${targetCategory.name}"`,
      });
    }

    // Copy profession data to the target category (new _id will be generated)
    const professionData = {
      name: profession.name,
      icon: profession.icon,
      isQuickAccess: profession.isQuickAccess,
      quickAccessOrder: profession.quickAccessOrder,
      createdAt: profession.createdAt,
      updatedAt: new Date(),
    };

    targetCategory.professions.push(professionData);
    await targetCategory.save();

    // Get the newly created profession in the target category
    const newProfession = targetCategory.professions[targetCategory.professions.length - 1];

    // Remove from source category
    sourceCategory.professions.pull(professionId);
    await sourceCategory.save();

    // Update any existing jobs that reference this profession's categoryId
    try {
      const jobResult = await Job.updateMany(
        { professionName: profession.name, 'jobCategory': sourceCategory._id },
        { $set: { 'jobCategory': targetCategory._id } }
      );
      if (jobResult.modifiedCount > 0) {
        console.log(`[Configurations] Transferred ${jobResult.modifiedCount} jobs to new category.`);
      }
    } catch (jobErr) {
      console.warn(`[Configurations] Could not update jobs during transfer: ${jobErr.message}`);
    }

    // Update drafts
    try {
      const draftsCollection = mongoose.connection.collection('drafts');
      const draftResult = await draftsCollection.updateMany(
        { professionName: profession.name, 'jobCategory': sourceCategory._id },
        { $set: { 'jobCategory': targetCategory._id } }
      );
      if (draftResult.modifiedCount > 0) {
        console.log(`[Configurations] Transferred ${draftResult.modifiedCount} drafts to new category.`);
      }
    } catch (draftErr) {
      console.warn(`[Configurations] Could not update drafts during transfer: ${draftErr.message}`);
    }

    console.log(
      `[Configurations] Profession "${profession.name}" transferred from "${sourceCategory.name}" to "${targetCategory.name}".`
    );

    res.status(200).json({
      success: true,
      message: `Profession "${profession.name}" transferred to "${targetCategory.name}" successfully`,
      profession: newProfession,
      sourceCategoryId: sourceCategory._id,
      targetCategoryId: targetCategory._id,
    });
  } catch (error) {
    console.error('Error transferring profession:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to transfer profession',
      error: error.message,
    });
  }
};

exports.uploadCategoryIcon = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const { buffer, originalname } = req.file;
    const { categoryName, oldIcon } = req.body;

    if (!categoryName) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    const fileExtension = path.extname(originalname);
    const sanitizedCategoryName = categoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const fileName = `${sanitizedCategoryName}${fileExtension}`;

    const kayodPath = path.join(
      __dirname,
      '../../../..',
      'kayod/client/src/assets/icons/categories',
      fileName
    );

    const kayodManagePath = path.join(
      __dirname,
      '../../..',
      'Frontend/public/assets/icons/categories',
      fileName
    );

    const kayodDir = path.dirname(kayodPath);
    const kayodManageDir = path.dirname(kayodManagePath);

    if (!fs.existsSync(kayodDir)) {
      fs.mkdirSync(kayodDir, { recursive: true });
    }
    if (!fs.existsSync(kayodManageDir)) {
      fs.mkdirSync(kayodManageDir, { recursive: true });
    }

    // Delete any existing icon files for this category (including old timestamp versions)
    const existingFiles = fs.readdirSync(kayodDir).filter(file => {
      const baseName = file.replace(path.extname(file), '');
      return baseName === sanitizedCategoryName || baseName.startsWith(`${sanitizedCategoryName}-`);
    });

    existingFiles.forEach(file => {
      const oldKayodPath = path.join(kayodDir, file);
      const oldKayodManagePath = path.join(kayodManageDir, file);

      try {
        if (fs.existsSync(oldKayodPath)) {
          fs.unlinkSync(oldKayodPath);
        }
      } catch (err) {
        console.warn(`Failed to delete old icon at ${oldKayodPath}:`, err.message);
      }

      try {
        if (fs.existsSync(oldKayodManagePath)) {
          fs.unlinkSync(oldKayodManagePath);
        }
      } catch (err) {
        console.warn(`Failed to delete old icon at ${oldKayodManagePath}:`, err.message);
      }
    });

    fs.writeFileSync(kayodPath, buffer);
    fs.writeFileSync(kayodManagePath, buffer);

    res.status(200).json({
      success: true,
      iconName: `custom:${fileName}`,
      fullPath: `/assets/icons/categories/${fileName}`,
      message: 'Icon uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading category icon:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload icon',
      error: error.message,
    });
  }
};

exports.uploadProfessionIcon = async (req, res) => {
  // Detect client cancellation: when the browser aborts the request (user clicked
  // "Cancel Upload"), the response socket closes before we finish writing. We upload to a
  // TEMPORARY name first and only promote it to the live icon if the client did NOT cancel,
  // so a cancelled upload never changes the saved icon.
  let clientAborted = false;
  res.on('close', () => {
    if (!res.writableFinished) clientAborted = true;
  });

  let tempFilePath = null;
  let tempFileId = null;

  try {
    console.log(`[Configurations] Starting profession icon upload for ${req.body.professionName}`);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const { buffer } = req.file;
    const { professionName, oldIcon, professionId } = req.body;

    if (!professionName) {
      return res.status(400).json({
        success: false,
        message: 'Profession name is required',
      });
    }

    // Use the shared slug so the uploaded filename matches what the Kayod client requests
    const sanitizedName = generateIconSlug(professionName);
    const fileName = `${sanitizedName}.webp`;
    // Unique, non-destructive staging name. The live icon is untouched until we commit.
    const tempName = `tmp-${sanitizedName}-${Date.now()}-${Math.round(Math.random() * 1e6)}.webp`;

    // 1) Upload the new image to the TEMP name. This is the slow part and is safe to cancel.
    console.log(`[Configurations] Staging profession icon on ImageKit: ${tempName}`);
    const tempResult = await imageKitService.uploadFile(
      buffer,
      tempName,
      'professionIconsUpload',
      ['profession-icon-temp', sanitizedName]
    );
    tempFilePath = tempResult.filePath;
    tempFileId = tempResult.fileId;

    // 2) If the user cancelled while the upload was in flight, discard the staged file and
    //    leave the existing icon exactly as it was.
    if (clientAborted) {
      await imageKitService.deleteFile(tempFileId);
      tempFileId = null;
      console.log(`[Configurations] Upload cancelled by client; staged file discarded, icon unchanged for "${professionName}"`);
      return; // connection already closed — nothing to respond
    }

    // 3) Commit. Free the target filename, drop any differently-named old icon, then promote
    //    the staged file to the live name.
    const deleteIkByName = async (name) => {
      try {
        const files = await imageKitService.listFiles({ name, path: 'professionIconsUpload' });
        const match = files && files.find(f => f.name === name);
        if (match) await imageKitService.deleteFile(match.fileId);
      } catch (e) {
        console.warn(`[Configurations] Could not delete ImageKit file ${name}: ${e.message}`);
      }
    };

    await deleteIkByName(fileName);

    if (oldIcon && oldIcon.startsWith('ik:')) {
      const oldFileName = oldIcon.replace('ik:', '').split('/').pop();
      if (oldFileName && oldFileName !== fileName) {
        await deleteIkByName(oldFileName);
      }
    }

    await imageKitService.renameFile(tempFilePath, fileName, true);
    tempFileId = null; // committed — the temp file no longer exists under its old name
    const ikPath = `ik:/professionIconsUpload/${fileName}`;

    // 4) Update the profession in the database with the new icon
    if (professionId) {
      const category = await JobCategory.findOne({
        'professions._id': professionId,
      });

      if (!category) {
        throw new Error('Profession not found');
      }

      const profession = category.professions.id(professionId);
      if (!profession) {
        throw new Error('Profession not found');
      }

      profession.icon = ikPath;
      profession.updatedAt = new Date();
      await category.save();
      console.log(`[Configurations] Updated profession icon in database: ${professionName} -> ${ikPath}`);
    }

    console.log(`[Configurations] Profession icon upload complete: ${professionName}`);
    res.status(200).json({
      success: true,
      iconName: ikPath,
      fullPath: `${process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/9vpn8u272'}/professionIconsUpload/${fileName}`,
      message: 'Profession icon uploaded to ImageKit successfully',
      professionId, // Return professionId for frontend reference
    });

    // Emit socket event for real-time update
    if (io) {
      try {
        const adminNamespace = io.of('/admin');
        adminNamespace.emit('configuration:updated', {
          type: 'profession',
          action: 'icon-updated',
          professionId,
          professionName,
          iconName: ikPath,
          timestamp: new Date()
        });
      } catch (socketErr) {
        console.error('Error emitting socket event:', socketErr);
      }
    }
  } catch (error) {
    // Clean up the staged temp file on any failure so we never leak orphans.
    if (tempFileId) {
      try { await imageKitService.deleteFile(tempFileId); } catch (e) { /* best effort */ }
    }
    console.error('Error uploading profession icon:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to upload profession icon',
        error: error.message,
      });
    }
  }
};

exports.updateQuickAccessProfessions = async (req, res) => {
  try {
    const { professions } = req.body;

    console.log('Received quick access update request:', professions);

    if (!Array.isArray(professions)) {
      return res.status(400).json({
        success: false,
        message: 'Professions must be an array',
      });
    }

    if (professions.length > 8) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 8 quick access professions allowed',
      });
    }

    const mongoose = require('mongoose');

    // Step 1 & 2 Combined: Reset all and set selected professions
    console.log('\ud83d� Updating professions...');
    const allCategories = await JobCategory.find();

    for (const category of allCategories) {
      let modified = false;

      category.professions.forEach(profession => {
        // Reset all to false first
        profession.isQuickAccess = false;
        profession.quickAccessOrder = 0;

        // Check if this profession is in the selected list
        const selectedIndex = professions.findIndex(
          p => p.professionId === profession._id.toString()
        );

        if (selectedIndex !== -1) {
          profession.isQuickAccess = true;
          profession.quickAccessOrder = selectedIndex + 1;
          modified = true;
          console.log(`  ✅ ${profession.name} (order: ${selectedIndex + 1})`);
        }
      });

      if (modified || category.professions.length > 0) {
        category.markModified('professions');
        await category.save({ validateModifiedOnly: false });
        console.log(`  💾 Saved category: ${category.name}`);
      }
    }

    // Step 3: Verify the changes
    console.log('\n🔍 Verifying saved data...');
    const verifyCategories = await JobCategory.find().lean();
    let verifiedCount = 0;

    verifyCategories.forEach(cat => {
      cat.professions.forEach(prof => {
        if (prof.isQuickAccess) {
          verifiedCount++;
          console.log(`  ✓ ${prof.name} (order: ${prof.quickAccessOrder}, category: ${cat.name})`);
        }
      });
    });

    console.log(`\nTotal verified quick access professions: ${verifiedCount}\n`);

    res.status(200).json({
      success: true,
      message: 'Quick access professions updated successfully',
      verifiedCount,
    });
  } catch (error) {
    console.error('❌ Error updating quick access professions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quick access professions',
      error: error.message,
    });
  }
};
