const JobCategory = require('../models/JobCategory');
const fs = require('fs');
const path = require('path');

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
    const { name, icon } = req.body;
    
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

    const category = await JobCategory.create({
      name: name.trim(),
      icon: icon || undefined,
      professions: [],
    });
    
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

    profession.updatedAt = new Date();
    
    await category.save();
    
    res.status(200).json({
      success: true,
      profession,
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
      
      if (fs.existsSync(oldKayodPath)) {
        fs.unlinkSync(oldKayodPath);
      }
      
      if (fs.existsSync(oldKayodManagePath)) {
        fs.unlinkSync(oldKayodManagePath);
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
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const { buffer, originalname } = req.file;
    const { professionName, oldIcon } = req.body;
    
    if (!professionName) {
      return res.status(400).json({
        success: false,
        message: 'Profession name is required',
      });
    }

    const fileExtension = path.extname(originalname);
    const sanitizedName = professionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const fileName = `${sanitizedName}${fileExtension}`;

    const kayodPath = path.join(
      __dirname,
      '../../../..',
      'kayod/client/src/assets/icons/professions',
      fileName
    );
    
    const kayodManagePath = path.join(
      __dirname,
      '../../..',
      'Frontend/public/assets/icons/professions',
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

    if (oldIcon && oldIcon.startsWith('custom:')) {
      const oldFileName = oldIcon.replace('custom:', '');
      const oldKayodPath = path.join(kayodDir, oldFileName);
      const oldKayodManagePath = path.join(kayodManageDir, oldFileName);
      
      if (fs.existsSync(oldKayodPath)) {
        fs.unlinkSync(oldKayodPath);
      }
      
      if (fs.existsSync(oldKayodManagePath)) {
        fs.unlinkSync(oldKayodManagePath);
      }
    }

    fs.writeFileSync(kayodPath, buffer);
    fs.writeFileSync(kayodManagePath, buffer);

    res.status(200).json({
      success: true,
      iconName: `custom:${fileName}`,
      fullPath: `/assets/icons/professions/${fileName}`,
      message: 'Profession icon uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading profession icon:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profession icon',
      error: error.message,
    });
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
