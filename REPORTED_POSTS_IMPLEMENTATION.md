# Reported Posts Implementation Guide - PHP Currency Version

This implementation provides a comprehensive system for handling reported posts in the KayodManage platform with **Philippine Peso (PHP)** currency formatting, allowing users to report inappropriate content and enabling admins to review and take action on these reports.

## 💰 **Currency Features**

The system now uses **Philippine Peso (PHP)** as the primary currency with proper formatting:

- **Frontend**: Uses `Intl.NumberFormat` with 'en-PH' locale for consistent PHP currency display
- **Backend**: Includes currency utility functions for proper PHP formatting in API responses
- **Format Examples**: ₱1,234.56, ₱50,000.00 (Fixed Price), ₱500.00 (Per Hour)
- **Utility Functions**: Comprehensive currency handling including compact format (₱1.2K, ₱1.5M)

## 🎯 **New Media Preservation Features**

### **Job Snapshot System**
When a report is submitted, the system now creates a complete snapshot of the job data including:
- **Job Details**: Title, description, category, budget, location
- **Media Files**: Images and videos with metadata
- **Job Poster Info**: User details for reference
- **Timestamps**: Creation and upload dates

This ensures that even if a job is deleted after being reported, administrators can still review all the original content.

### **Media Display Features**
- **Image Gallery**: Thumbnail previews with click-to-expand functionality
- **Video Player**: Inline video playback with controls
- **Media Metadata**: File names, sizes, upload dates
- **Deletion Indicators**: Clear marking of deleted posts
- **Media Summary**: Count of images vs videos
- **Error Handling**: Graceful fallback for missing media

## 🚀 Features Implemented

### Admin Features
- **View Reported Posts**: Complete list of all reported posts with detailed information
- **Filter & Sort**: Filter by status (all, pending, reviewed, resolved, dismissed)
- **Review System**: Detailed review interface with job and report information
- **Action Taking**: Admins can approve (keep), dismiss, or delete reported posts
- **Admin Notes**: Add administrative notes to reports for future reference
- **Bulk Operations**: Handle multiple reports at once
- **Statistics**: Dashboard showing report summaries and trends

### User Features
- **Report Posts**: Easy-to-use modal for reporting inappropriate content
- **Reason Selection**: Pre-defined categories for common report reasons
- **Detailed Comments**: Ability to provide specific details about the issue
- **Report Status**: Users can see when their reports have been processed

## 📁 Files Created/Modified

### Backend Files
```
Backend/
├── app/
│   ├── models/
│   │   └── ReportedPost.js          # MongoDB model for reported posts
│   ├── controllers/
│   │   └── adminController.js       # Controller handling all report operations
│   ├── routes/
│   │   └── admin.js                 # API routes for admin operations
│   └── utils/
│       └── currency.js              # PHP currency utility functions
└── server.js                        # Updated to include admin routes
```

### Frontend Files
```
Frontend/src/
├── pages/
│   └── Alerts.tsx                   # Updated admin alerts page with reported posts (table format)
├── components/
│   ├── Report/
│   │   ├── ReportPost.tsx          # Modal component for reporting posts
│   │   └── index.ts                # Export file
│   └── Jobs/
│       └── JobCardWithReport.tsx   # Example integration in job cards
└── utils/
    └── currency.ts                  # Frontend PHP currency utility functions
```

## 💰 **Currency Utilities**

### Frontend Currency Functions (`src/utils/currency.ts`)
```typescript
// Format currency in PHP
formatPHPCurrency(1000) // Returns: "₱1,000.00"

// Format budget with type
formatBudgetWithType(5000, 'hourly') // Returns: "₱5,000.00 (Per Hour)"

// Compact formatting for large amounts
formatCompactPHPCurrency(1500000) // Returns: "₱1.5M"

// Parse currency string to number
parsePHPCurrency("₱1,234.56") // Returns: 1234.56
```

### Backend Currency Functions (`app/utils/currency.js`)
```javascript
// Format currency for API responses
formatPHPCurrency(1000) // Returns: "₱1,000.00"

// Enhanced budget response with multiple formats
formatBudgetResponse(5000, 'hourly')
// Returns: {
//   amount: 5000,
//   formattedAmount: "₱5,000.00",
//   budgetType: "hourly",
//   budgetTypeLabel: "Per Hour",
//   compactAmount: "₱5.0K"
// }
```

## 🔧 API Endpoints

### Admin Endpoints (require admin authentication)
- `GET /api/admin/reported-posts` - Get all reported posts with filtering
- `GET /api/admin/reported-posts/summary` - Get report statistics
- `GET /api/admin/reported-posts/:reportId` - Get specific reported post
- `PUT /api/admin/reported-posts/:reportId/review` - Review and take action
- `PATCH /api/admin/reported-posts/bulk-update` - Bulk update multiple reports

### User Endpoints (require user authentication)
- `POST /api/admin/report-post` - Submit a new report

## 📊 Database Schema

### ReportedPost Model (Enhanced)
```javascript
{
  jobId: ObjectId,              // Reference to reported job
  jobSnapshot: {               // Complete job data snapshot
    title: String,
    description: String,
    category: String,
    budget: Number,
    budgetType: String,
    paymentMethod: String,
    location: Object,
    media: [{
      type: String,            // File URL or path
      mediaType: String,       // 'image' or 'video'
      originalName: String,    // Original filename
      fileSize: Number,        // Size in bytes
      uploadedAt: Date         // Upload timestamp
    }],
    icon: String,
    date: Date,
    isUrgent: Boolean,
    serviceTier: String,
    status: String,
    createdAt: Date,
    jobPosterInfo: {
      name: String,
      email: String,
      phone: String
    }
  },
  reportedBy: ObjectId,         // User who submitted the report
  jobPosterId: ObjectId,        // Owner of the reported job
  reason: String,               // Reason for reporting (enum)
  comment: String,              // Detailed explanation
  status: String,               // pending, reviewed, resolved, dismissed
  reviewedBy: ObjectId,         // Admin who reviewed (optional)
  reviewedAt: Date,             // Review timestamp (optional)
  adminNotes: String,           // Admin notes (optional)
  actionTaken: String,          // Action taken by admin
  reportMetadata: Object,       // Additional tracking info
  createdAt: Date,              // Report submission time
  updatedAt: Date               // Last update time
}
```

### Available Report Reasons
- `inappropriate_content` - Inappropriate Content
- `spam` - Spam or Repetitive Posting
- `scam_or_fraud` - Scam or Fraudulent Activity
- `misleading_information` - Misleading Information
- `copyright_violation` - Copyright Violation
- `discrimination` - Discrimination
- `harassment` - Harassment or Bullying
- `violence_or_threats` - Violence or Threats
- `adult_content` - Adult Content
- `fake_job_posting` - Fake Job Posting
- `duplicate_posting` - Duplicate Posting
- `other` - Other (Please specify in comments)

## 🎯 Usage Instructions

### 1. Admin Usage
1. Navigate to the **Alerts** page in the admin panel
2. View all reported posts with filtering options
3. Click "Review & Take Action" on pending reports
4. Review job details and report information
5. Add admin notes and choose an action:
   - **Keep Post**: Dismiss the report, keep the job active
   - **Dismiss Report**: Mark as dismissed without action
   - **Delete Post**: Remove the job and resolve the report

### 2. User Reporting
```jsx
import { ReportPost } from '../components/Report';

function JobCard({ job, currentUserId }) {
  const [showReportModal, setShowReportModal] = useState(false);
  
  return (
    <div>
      {/* Your job card content */}
      
      <button onClick={() => setShowReportModal(true)}>
        Report this post
      </button>
      
      <ReportPost
        jobId={job._id}
        jobTitle={job.title}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReportSubmitted={() => {
          // Handle successful report submission
          console.log('Report submitted');
        }}
      />
    </div>
  );
}
```

## 🔒 Security Features

### Duplicate Prevention
- Users cannot report the same job multiple times
- Unique compound index on `(jobId, reportedBy)`

### Authentication
- Admin routes require admin authentication token
- User report submission requires user authentication
- Admin notes and actions are logged with admin IDs

### Data Validation
- Input validation on all endpoints
- Comment length limits (10-1000 characters)
- Enum validation for reasons and statuses

## 🚦 Status Flow

```
pending → reviewed → resolved (if post deleted)
pending → reviewed → dismissed (if report dismissed)
```

## 📈 Monitoring & Analytics

### Available Statistics
- Total reports by status
- Recent reports (last 7 days)
- Top report reasons
- Admin response times
- Resolution rates

### Admin Dashboard Metrics
```javascript
{
  total: 150,
  pending: 23,
  reviewed: 45,
  resolved: 67,
  dismissed: 15,
  recentReports: 8,
  topReasons: [
    { _id: "spam", count: 45 },
    { _id: "inappropriate_content", count: 32 }
  ]
}
```

## 🔧 Configuration

### Environment Variables
No additional environment variables are required. The system uses existing database and authentication configurations.

### Database Indexes
The system automatically creates indexes for:
- Report status
- Creation date
- Job ID
- Reporter ID
- Compound indexes for common queries

## 🚀 Deployment Notes

1. **Database Migration**: The ReportedPost collection will be created automatically when the first report is submitted
2. **Existing Data**: No migration needed for existing data
3. **Admin Routes**: Ensure admin authentication middleware is properly configured
4. **Frontend Integration**: Import and use the ReportPost component in job listings/details pages

## 🔍 Testing

### Admin Testing Checklist
- [ ] View reported posts list
- [ ] Filter by different statuses
- [ ] Review individual reports
- [ ] Take actions (approve, dismiss, delete)
- [ ] Add admin notes
- [ ] Test bulk operations

### User Testing Checklist
- [ ] Report a job post
- [ ] Try reporting same job twice (should fail)
- [ ] Test different report reasons
- [ ] Verify character limits
- [ ] Check form validation

## 🆘 Troubleshooting

### Common Issues

1. **"Failed to fetch reported posts"**
   - Check admin authentication token
   - Verify API endpoint is accessible
   - Check server logs for database connection issues

2. **"You have already reported this job"**
   - This is expected behavior to prevent spam
   - Users can only report each job once

3. **Report submission fails**
   - Verify user authentication
   - Check if required fields are provided
   - Ensure job exists and is accessible

### Debug Mode
Add console.log statements to track:
- API request/response cycles
- Database query execution
- Authentication token validation

## 📞 Support

If you encounter any issues with this implementation:

1. Check the browser console for JavaScript errors
2. Check server logs for API errors
3. Verify database connectivity
4. Ensure all required dependencies are installed
5. Check authentication middleware configuration

## 🔄 Future Enhancements

Potential improvements that could be added:
- Email notifications for users when their reports are processed
- Automated moderation using AI/ML
- Report escalation system
- User reputation system based on report history
- Advanced analytics and reporting dashboard
- Integration with external moderation tools