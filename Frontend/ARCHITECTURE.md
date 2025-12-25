# Alerts Feature - Complete Architecture

This document provides an overview of the complete Alerts feature architecture with proper separation of concerns.

## 📁 Project Structure

```
Frontend/src/
├── components/
│   ├── Modals/
│   │   ├── index.ts                    # Export all modals
│   │   ├── ReviewReportModal.tsx       # Review report modal component
│   │   └── README.md                   # Modals documentation
│   └── SideModal.tsx                   # Base modal component
├── pages/
│   └── Alerts.tsx                      # Main alerts page (clean & focused)
├── services/
│   ├── index.ts                        # Export all services
│   ├── alertsService.ts               # Alerts API service layer
│   └── README.md                       # Services documentation
├── types/
│   ├── index.ts                        # Export all types
│   └── alerts.types.ts                # Alert type definitions
└── utils/
    └── apiClient.ts                    # Axios instance with interceptors

Backend/app/
├── controllers/
│   └── adminController.js              # Alert/report controller
├── models/
│   └── ReportedPost.js                 # ReportedPost model
└── routes/
    └── admin.js                         # Alert routes
```

## 🏗️ Architecture Layers

### 1. **Types Layer** (`src/types/`)
Provides TypeScript type safety across the entire feature.

**Files:**
- `alerts.types.ts` - All alert-related interfaces and types
- `index.ts` - Central export point

**Key Types:**
```typescript
- ReportedPost          # Main data structure
- JobDetails            # Job information
- ReporterInfo          # Reporter details
- ReportedPostsResponse # API response
- ReviewPostRequest     # Review action payload
- ReportFilterStatus    # Filter type
```

### 2. **Services Layer** (`src/services/`)
Handles all API communication using the configured `apiClient`.

**Files:**
- `alertsService.ts` - Alert API methods
- `index.ts` - Central export point
- `README.md` - Documentation

**Methods:**
```typescript
- getReportedPosts()      # Fetch all reports
- getReportedPostById()   # Get single report
- reviewReportedPost()    # Review and take action
- getReportsSummary()     # Get statistics
- bulkUpdateReports()     # Bulk operations
- createReport()          # Create new report
```

### 3. **Components Layer** (`src/components/Modals/`)
Reusable modal components for displaying and interacting with data.

**Files:**
- `ReviewReportModal.tsx` - Review report modal
- `index.ts` - Central export point
- `README.md` - Documentation

**Modal Props:**
```typescript
interface ReviewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedPost: ReportedPost | null;
  onReview: (postId: string, action: string) => Promise<void>;
  isLoading: boolean;
}
```

### 4. **Pages Layer** (`src/pages/`)
Page components that orchestrate services, modals, and UI.

**Responsibilities:**
- State management
- Data fetching via services
- User interaction handling
- Modal control
- Table rendering and pagination

## 🔄 Data Flow

### Viewing Reports
```
User Action (Page)
    ↓
alertsService.getReportedPosts()
    ↓
apiClient (Axios)
    ↓
Backend API (/api/admin/reported-posts)
    ↓
adminController.getReportedPosts()
    ↓
ReportedPost.find() (MongoDB)
    ↓
Response → Page State Update → UI Render
```

### Reviewing a Report
```
User Clicks Review (Page)
    ↓
Opens ReviewReportModal
    ↓
User Selects Action (Modal)
    ↓
onReview callback to Page
    ↓
alertsService.reviewReportedPost()
    ↓
Backend API (/api/admin/reported-posts/:id/review)
    ↓
adminController.reviewReportedPost()
    ↓
Update ReportedPost & Job (if delete)
    ↓
Response → Page Updates State → Modal Closes → UI Updates
```

## 📦 Component Breakdown

### Alerts.tsx (Page)
**Responsibilities:**
- Fetch and display reports
- Handle search and filtering
- Manage pagination
- Open/close modal
- Coordinate review actions

**Key Features:**
- Search functionality
- Status filters (All, Pending, Reviewed, Resolved, Dismissed)
- Responsive table/cards
- Pagination
- Error handling
- Loading states

### ReviewReportModal.tsx
**Responsibilities:**
- Display full report details
- Show job information
- Display media files
- Show reporter information
- Provide action buttons
- Handle admin notes

**Key Features:**
- Job details section
- Media gallery
- Report details
- Admin notes (editable for pending)
- Action buttons (Dismiss, Keep, Delete)
- Loading states

### alertsService.ts
**Responsibilities:**
- API communication
- Type-safe request/response handling
- Error propagation

**Benefits:**
- Centralized API logic
- Easy to mock for testing
- Type safety
- Reusable across components

## 🎨 UI Components Structure

```
Alerts Page
├── Header
│   ├── Title & Icon
│   └── Pending Count Badge
├── Search & Filters
│   ├── Search Input
│   └── Status Tabs (All, Pending, etc.)
├── Table/Cards
│   ├── Job Details Column
│   ├── Report Info Column
│   ├── Status Column
│   ├── Date Column
│   └── Actions Column (View/Review button)
├── Pagination
│   └── Page Controls
└── ReviewReportModal
    ├── Status Badge
    ├── Job Details
    ├── Job Media Gallery
    ├── Report Details
    ├── Admin Notes (if pending)
    └── Action Buttons (if pending)
```

## 🔐 Type Safety Flow

```typescript
// Types define the contract
interface ReportedPost { ... }

// Service enforces types
async getReportedPosts(): Promise<ReportedPostsResponse> { ... }

// Page uses typed data
const [posts, setPosts] = useState<ReportedPost[]>([]);

// Modal receives typed props
<ReviewReportModal reportedPost={selectedPost} ... />
```

## 🚀 Benefits of This Architecture

### 1. **Separation of Concerns**
- Types: Data structure definitions
- Services: API communication
- Modals: Reusable UI components
- Pages: Orchestration and state management

### 2. **Maintainability**
- Changes to API → Update service only
- Changes to modal UI → Update modal only
- Changes to types → TypeScript catches issues

### 3. **Reusability**
- Services can be used in any component
- Modals can be used on multiple pages
- Types ensure consistency

### 4. **Testability**
- Services can be easily mocked
- Modals can be tested in isolation
- Type safety catches errors early

### 5. **Scalability**
- Easy to add new services
- Easy to add new modals
- Pattern is consistent and predictable

## 📝 Code Examples

### Using the Service
```typescript
import { alertsService } from '../services';
import type { ReportedPost } from '../types';

const fetchData = async () => {
  const data = await alertsService.getReportedPosts();
  setPosts(data.reportedPosts);
};
```

### Using the Modal
```typescript
import { ReviewReportModal } from '../components/Modals';

<ReviewReportModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  reportedPost={selectedPost}
  onReview={handleReview}
  isLoading={actionLoading}
/>
```

### Using Types
```typescript
import type { ReportedPost, ReportFilterStatus } from '../types';

const [posts, setPosts] = useState<ReportedPost[]>([]);
const [filter, setFilter] = useState<ReportFilterStatus>('all');
```

## 🔄 Adding New Features

### Adding a New Modal
1. Create `YourModal.tsx` in `components/Modals/`
2. Export from `components/Modals/index.ts`
3. Import and use: `import { YourModal } from '../components/Modals'`

### Adding a New Service
1. Create `yourService.ts` in `services/`
2. Create `yourService.types.ts` in `types/`
3. Export from respective index files
4. Import and use: `import { yourService } from '../services'`

### Adding New Types
1. Add to `alerts.types.ts` or create new types file
2. Export from `types/index.ts`
3. Import: `import type { YourType } from '../types'`

## 📚 Best Practices

1. **Always use TypeScript**: Define types for everything
2. **Keep services thin**: Just API calls, no business logic
3. **Keep modals focused**: One modal = one purpose
4. **Use callbacks**: Pass callbacks to modals for actions
5. **Handle loading states**: Always show loading indicators
6. **Error handling**: Display errors appropriately
7. **Validation**: Validate before API calls
8. **Documentation**: Keep READMEs updated

## 🎯 Summary

This architecture provides:
- **Clean code** - Each file has a single responsibility
- **Type safety** - TypeScript catches errors early
- **Reusability** - Services and modals are reusable
- **Maintainability** - Changes are isolated and predictable
- **Scalability** - Easy to extend with new features
- **Testability** - Components can be tested in isolation

The Alerts feature demonstrates a professional, production-ready architecture that can serve as a template for all other features in the application.
