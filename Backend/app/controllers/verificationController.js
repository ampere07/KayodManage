// Debug endpoint to test direct connection to Kayod backend
exports.testKayodConnection = async (req, res) => {
  try {
    console.log('🔍 Testing direct connection to Kayod backend...');
    
    const response = await makeKayodRequest('GET', '/credential-verification/admin/all?limit=5&skip=0');
    
    console.log('✅ Raw response from Kayod backend:');
    console.log(JSON.stringify(response, null, 2));
    
    res.json({
      success: true,
      message: 'Direct connection test',
      rawResponse: response,
      dataExists: !!response?.data,
      dataType: typeof response?.data,
      dataLength: Array.isArray(response?.data) ? response.data.length : 'not array',
      firstItem: Array.isArray(response?.data) && response.data.length > 0 ? response.data[0] : null
    });
  } catch (error) {
    console.error('❌ Test connection failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
};

const axios = require('axios');

// Configuration for connecting to the main Kayod backend
const KAYOD_BACKEND_URL = process.env.KAYOD_BACKEND_URL || 'http://localhost:3001';
const KAYOD_API_KEY = process.env.KAYOD_API_KEY || '';

// Cloudinary configuration (update these with your actual Cloudinary settings)
const CLOUDINARY_BASE_URL = process.env.CLOUDINARY_BASE_URL || 'https://res.cloudinary.com/your-cloud-name';
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_VERIFICATION_FOLDER || 'kayod-verifications';

// Helper function to generate Cloudinary URLs based on userId and image type
const generateImageUrl = (userId, imageType, fileExtension = 'jpg') => {
  // Image naming pattern: userId_imageType.extension
  // Examples: 
  // - user123_face.jpg (face verification)
  // - user123_id.jpg (valid ID)
  // - user123_cert1.jpg, user123_cert2.jpg (credentials)
  const publicId = `${CLOUDINARY_FOLDER}/${userId}_${imageType}`;
  return `${CLOUDINARY_BASE_URL}/image/upload/${publicId}.${fileExtension}`;
};

// Helper function to check if image exists (optional - for error handling)
const checkImageExists = async (imageUrl) => {
  try {
    const response = await axios.head(imageUrl);
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

// Helper function to construct verification data with proper image URLs
const constructVerificationData = (userId, userData = {}) => {
  const baseData = {
    _id: userId,
    userId: {
      _id: userId,
      name: userData.name || `User ${userId}`,
      email: userData.email || `user${userId}@example.com`,
      userType: userData.userType || 'provider',
      profileImage: userData.profileImage || null
    },
    faceVerification: {
      cloudinaryUrl: generateImageUrl(userId, 'face'),
      publicId: `${userId}_face`,
      uploadedAt: new Date().toISOString(),
      originalName: 'face-verification.jpg'
    },
    validId: {
      type: userData.idType || 'national_id',
      cloudinaryUrl: generateImageUrl(userId, 'id'),
      publicId: `${userId}_id`,
      uploadedAt: new Date().toISOString(),
      originalName: 'valid-id.jpg'
    },
    credentials: [],
    status: userData.status || 'pending',
    submittedAt: userData.submittedAt || new Date().toISOString(),
    verificationAttempts: userData.attempts || 1
  };

  // Generate credential images (assuming max 5 credentials per user)
  const credentialCount = userData.credentialCount || 2;
  for (let i = 1; i <= credentialCount; i++) {
    baseData.credentials.push({
      originalName: `credential-${i}.jpg`,
      cloudinaryUrl: generateImageUrl(userId, `cert${i}`),
      publicId: `${userId}_cert${i}`,
      uploadedAt: new Date().toISOString(),
      type: userData.credentialTypes?.[i-1] || 'certificate'
    });
  }

  return baseData;
};

// Helper function to make requests to the main Kayod backend
const makeKayodRequest = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${KAYOD_BACKEND_URL}/api${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KAYOD_API_KEY
      }
    };

    if (data) {
      config.data = data;
    }

    console.log(`🔌 Making request to Kayod backend:`);
    console.log(`   URL: ${config.url}`);
    console.log(`   Method: ${config.method}`);
    console.log(`   Headers:`, config.headers);
    
    const response = await axios(config);
    console.log(`✅ Request successful:`, response.status);
    return response.data;
  } catch (error) {
    console.error('❌ Error making request to Kayod backend:');
    console.error('   URL:', `${KAYOD_BACKEND_URL}/api${endpoint}`);
    console.error('   Method:', method);
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.message);
    console.error('   Response data:', error.response?.data);
    throw error;
  }
};

// Get all verifications
exports.getAllVerifications = async (req, res) => {
  try {
    // Get query parameters for filtering
    const { status, limit = 50, skip = 0 } = req.query;

    // Build query string
    let queryString = `?limit=${limit}&skip=${skip}`;
    if (status) {
      queryString += `&status=${status}`;
    }

    try {
      // Make request to Kayod backend
      const response = await makeKayodRequest(
        'GET',
        `/credential-verification/admin/all${queryString}`
      );

      console.log('📋 Response received from Kayod backend:');
      console.log('   Response keys:', response ? Object.keys(response) : 'null/undefined');
      console.log('   Response.data type:', typeof response?.data);
      console.log('   Response.data length:', Array.isArray(response?.data) ? response.data.length : 'not array');
      console.log('   Full response:', JSON.stringify(response, null, 2));

      if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log('✅ Using real data from Kayod backend');
        // Use the actual verification data with original cloudinaryUrls - don't override them!
        return res.json({
          success: true,
          data: response.data
        });
      } else {
        console.log('❌ No valid data found in response, falling back to mock data');
      }
    } catch (apiError) {
      console.log('❌ Main backend not available, using mock data with userId-based images:', apiError.message);
    }

    // Fallback to mock data with realistic userId-based image URLs
    const mockVerifications = [
      constructVerificationData('507f1f77bcf86cd799439011', {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        userType: 'service_provider',
        status: 'pending',
        idType: 'passport',
        credentialCount: 2,
        credentialTypes: ['university_degree', 'professional_license'],
        submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }),
      constructVerificationData('507f1f77bcf86cd799439012', {
        name: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        userType: 'service_provider',
        status: 'approved',
        idType: 'drivers_license',
        credentialCount: 3,
        credentialTypes: ['technical_certification', 'work_experience', 'training_certificate'],
        submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedBy: {
          _id: 'admin1',
          name: 'Admin User',
          email: 'admin@kayod.com'
        },
        adminNotes: 'All documents verified successfully'
      }),
      constructVerificationData('507f1f77bcf86cd799439013', {
        name: 'Alice Williams',
        email: 'alice.williams@example.com',
        userType: 'service_provider',
        status: 'rejected',
        idType: 'national_id',
        credentialCount: 1,
        credentialTypes: ['university_diploma'],
        submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedBy: {
          _id: 'admin1',
          name: 'Admin User',
          email: 'admin@kayod.com'
        },
        rejectionReason: 'ID document is not clearly visible. Please resubmit with better lighting.',
        adminNotes: 'Face verification passed, but ID document needs to be resubmitted'
      }),
      constructVerificationData('507f1f77bcf86cd799439014', {
        name: 'Carlos Rodriguez',
        email: 'carlos.rodriguez@example.com',
        userType: 'service_provider',
        status: 'under_review',
        idType: 'passport',
        credentialCount: 4,
        credentialTypes: ['masters_degree', 'professional_certification', 'language_certificate', 'work_portfolio'],
        submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }),
      constructVerificationData('507f1f77bcf86cd799439015', {
        name: 'Maria Gonzalez',
        email: 'maria.gonzalez@example.com',
        userType: 'client',
        status: 'pending',
        idType: 'national_id',
        credentialCount: 1,
        credentialTypes: ['business_license'],
        submittedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      })
    ];

    // Add review information for approved/rejected items
    mockVerifications.forEach(verification => {
      if (verification.status === 'approved') {
        verification.reviewedAt = verification.reviewedAt || new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
        verification.reviewedBy = verification.reviewedBy || {
          _id: 'admin1',
          name: 'Admin User',
          email: 'admin@kayod.com'
        };
      }
      if (verification.status === 'rejected') {
        verification.reviewedAt = verification.reviewedAt || new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
        verification.reviewedBy = verification.reviewedBy || {
          _id: 'admin1',
          name: 'Admin User',
          email: 'admin@kayod.com'
        };
      }
    });

    console.log(`📊 Returning ${mockVerifications.length} mock verifications with userId-based image URLs`);
    
    res.json({
      success: true,
      data: mockVerifications
    });
  } catch (error) {
    console.error('Error fetching verifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch verifications',
      error: error.message
    });
  }
};

// Get verification by ID
exports.getVerificationById = async (req, res) => {
  try {
    const { verificationId } = req.params;

    try {
      const response = await makeKayodRequest(
        'GET',
        `/credential-verification/${verificationId}`
      );

      console.log('📋 Single verification response from Kayod backend:');
      console.log('   Response keys:', response ? Object.keys(response) : 'null/undefined');
      console.log('   Response.data exists:', !!response?.data);
      console.log('   Full response:', JSON.stringify(response, null, 2));

      if (response && response.data) {
        console.log('✅ Using real single verification data from Kayod backend');
        // Use the actual verification data with original cloudinaryUrls - don't override them!
        return res.json({
          success: true,
          data: response.data
        });
      } else {
        console.log('❌ No valid single verification data found, falling back to mock');
      }
    } catch (apiError) {
      console.log('❌ Single verification: Main backend not available, using mock data:', apiError.message);
    }

    // Return mock data for development
    const mockVerification = constructVerificationData(verificationId, {
      name: 'Mock User',
      email: 'mock.user@example.com',
      userType: 'service_provider',
      status: 'pending',
      idType: 'national_id',
      credentialCount: 2,
      credentialTypes: ['university_degree', 'professional_license']
    });

    res.json({
      success: true,
      data: mockVerification
    });
  } catch (error) {
    console.error('Error fetching verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch verification details',
      error: error.message
    });
  }
};

// Get user images by userId (new endpoint for direct image access)
exports.getUserImages = async (req, res) => {
  try {
    const { userId } = req.params;
    const { imageType } = req.query; // face, id, cert1, cert2, etc.

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'UserId is required'
      });
    }

    // Generate image URLs based on userId
    const imageUrls = {
      faceVerification: generateImageUrl(userId, 'face'),
      validId: generateImageUrl(userId, 'id'),
      credentials: []
    };

    // Generate credential image URLs (check for up to 10 possible credentials)
    for (let i = 1; i <= 10; i++) {
      const credentialUrl = generateImageUrl(userId, `cert${i}`);
      imageUrls.credentials.push({
        index: i,
        url: credentialUrl,
        publicId: `${userId}_cert${i}`
      });
    }

    // If specific imageType is requested, return only that URL
    if (imageType) {
      let requestedUrl;
      switch (imageType) {
        case 'face':
          requestedUrl = imageUrls.faceVerification;
          break;
        case 'id':
          requestedUrl = imageUrls.validId;
          break;
        default:
          // Check if it's a credential request (cert1, cert2, etc.)
          const certMatch = imageType.match(/^cert(\d+)$/);
          if (certMatch) {
            const certIndex = parseInt(certMatch[1]);
            requestedUrl = generateImageUrl(userId, `cert${certIndex}`);
          }
      }

      if (requestedUrl) {
        return res.json({
          success: true,
          data: {
            userId,
            imageType,
            url: requestedUrl
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid image type. Use: face, id, cert1, cert2, etc.'
        });
      }
    }

    // Return all image URLs
    res.json({
      success: true,
      data: {
        userId,
        images: imageUrls
      }
    });
  } catch (error) {
    console.error('Error fetching user images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user images',
      error: error.message
    });
  }
};

// Update verification status
exports.updateVerificationStatus = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { status, adminNotes, rejectionReason } = req.body;

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'under_review'];
    if (!validStatuses.includes(status)) {
    return res.status(400).json({
    success: false,
    message: 'Invalid status value'
    });
    }

    // Make request to update status
    const response = await makeKayodRequest(
      'PUT',
      `/credential-verification/admin/${verificationId}/status`,
      {
        status,
        adminNotes,
        rejectionReason,
        reviewedBy: req.admin?.id || 'admin' // Get admin ID from auth middleware
      }
    );

    // If the main backend is not available, return success for development
    if (!response) {
      return res.json({
        success: true,
        message: 'Verification status updated successfully (mock)',
        data: {
          _id: verificationId,
          status,
          adminNotes,
          rejectionReason,
          reviewedAt: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      message: 'Verification status updated successfully',
      data: response.data || response.verification
    });
  } catch (error) {
    console.error('Error updating verification status:', error);
    
    // Return success for development if the main backend is not available
    res.json({
      success: true,
      message: 'Verification status updated successfully (mock)',
      data: {
        _id: req.params.verificationId,
        status: req.body.status,
        adminNotes: req.body.adminNotes,
        rejectionReason: req.body.rejectionReason,
        reviewedAt: new Date().toISOString()
      }
    });
  }
};

// Get verification statistics
exports.getVerificationStats = async (req, res) => {
  try {
    const response = await makeKayodRequest(
      'GET',
      '/credential-verification/admin/stats'
    );

    // If the main backend is not available, return mock stats
    if (!response) {
      return res.json({
        success: true,
        data: {
          total: 10,
          pending: 3,
          approved: 5,
          rejected: 1,
          under_review: 1,
          averageProcessingDays: 2.5
        }
      });
    }

    res.json({
      success: true,
      data: response.data || response.stats
    });
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    
    // Return mock stats for development
    res.json({
      success: true,
      data: {
        total: 10,
        pending: 3,
        approved: 5,
        rejected: 1,
        under_review: 1,
        averageProcessingDays: 2.5
      }
    });
  }
};
