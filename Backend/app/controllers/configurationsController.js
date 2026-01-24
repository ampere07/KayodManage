const JobCategory = require('../models/JobCategory');

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
    const { name } = req.body;
    
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
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    const category = await JobCategory.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
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
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Profession name is required',
      });
    }

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
