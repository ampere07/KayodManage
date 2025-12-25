# ChatSideModal Component

A professional two-column chat side modal component for handling support tickets with user information display.

## Features

- **Two-Column Layout**:
  - **Column 1**: Ticket header with status badges, real-time chat interface, and message input
  - **Column 2**: User information panel, ticket details, and recent activity timeline

- **Real-time Messaging**: Send and receive messages with visual distinction between admin and user messages
- **Ticket Management**: View ticket status, priority, category, and resolve tickets
- **User Profile Display**: Shows user avatar, contact information, and account details
- **Activity Timeline**: Displays chronological ticket events
- **Responsive Design**: Clean, professional UI with Tailwind CSS styling

## Installation

The component is already integrated with your project's type system and uses existing types from:
- `types/support.types.ts`
- `types/users.types.ts`

## Usage

```tsx
import ChatSideModal from './components/Support/ChatSideModal';
import { ChatSupport } from './types/support.types';
import { User } from './types/users.types';

function YourComponent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ChatSupport | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleSendMessage = async (message: string) => {
    // Your API call to send message
    await api.sendMessage(selectedTicket._id, message);
  };

  const handleResolveTicket = async () => {
    // Your API call to resolve ticket
    await api.resolveTicket(selectedTicket._id);
    setIsModalOpen(false);
  };

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>
        Open Ticket
      </button>

      <ChatSideModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ticket={selectedTicket}
        user={selectedUser}
        onSendMessage={handleSendMessage}
        onResolveTicket={handleResolveTicket}
      />
    </>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Controls modal visibility |
| `onClose` | `() => void` | Yes | Callback when modal is closed |
| `ticket` | `ChatSupport \| null` | Yes | Ticket data object |
| `user` | `User \| null` | Yes | User data object |
| `onSendMessage` | `(message: string) => Promise<void>` | Yes | Handler for sending messages |
| `onResolveTicket` | `() => Promise<void>` | No | Handler for resolving tickets (optional) |

## Component Structure

```
ChatSideModal
├── Column 1: Chat Area
│   ├── Header Section
│   │   ├── Ticket ID & Subject
│   │   ├── Status/Priority/Category Badges
│   │   └── Resolve Button (if ticket is open)
│   ├── Messages Area
│   │   └── Scrollable message list
│   └── Message Input (if ticket is open)
│       └── Text input + Send button
│
└── Column 2: User Information
    ├── User Information Section
    │   ├── Profile Picture/Avatar
    │   ├── Name & Email
    │   └── User Details (Type, Member Since)
    ├── Ticket Details Section
    │   ├── Ticket ID
    │   ├── Created At
    │   ├── Last Update
    │   └── Assigned To
    └── Recent Activity Section
        └── Timeline of ticket events
```

## Styling

The component uses Tailwind CSS utility classes and follows these design principles:

- **Colors**:
  - Primary action: Blue (#2563EB)
  - Success: Green (#16A34A)
  - Warning: Orange/Yellow
  - Error: Red (#DC2626)
  - Neutral: Gray scale

- **Priority Colors**:
  - Urgent: Red background
  - High: Orange background
  - Medium: Yellow background
  - Low: Green background

- **Status Colors**:
  - Open: Blue background
  - Closed: Gray background

## Features in Detail

### Message Display
- Admin messages appear on the right with blue background
- User messages appear on the left with white background and border
- Each message shows sender name and timestamp
- Auto-scrolls to latest message

### Ticket Resolution
- Resolve button only appears when ticket status is "open"
- Clicking resolve calls the `onResolveTicket` handler
- Message input is disabled for closed tickets

### User Information
- Displays user profile image or default avatar
- Shows first name and last name (parsed from full name)
- Displays user type, email, and member since date
- Falls back to "User information not available" if user is null

### Activity Timeline
- Shows ticket submission event
- Shows ticket resolution event (if closed)
- Shows ticket acceptance event (if accepted)
- Each event includes icon and formatted date

## Keyboard Shortcuts

- **Escape**: Close modal
- **Enter**: Send message (when focused on input)
- **Shift + Enter**: New line in message (when focused on input)

## Accessibility

- Proper ARIA labels for buttons
- Keyboard navigation support
- Focus management
- Screen reader friendly structure

## Integration with Your API

Replace the example API calls in `ChatSideModalExample.tsx` with your actual API endpoints:

```typescript
// Send message
const handleSendMessage = async (message: string) => {
  const response = await fetch(`/api/support/tickets/${ticket._id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  // Handle response
};

// Resolve ticket
const handleResolveTicket = async () => {
  const response = await fetch(`/api/support/tickets/${ticket._id}/resolve`, {
    method: 'PUT'
  });
  // Handle response
};
```

## Notes

- The component automatically prevents body scroll when open
- Messages are displayed in chronological order
- The component is fully typed with TypeScript
- No redundant functionality - only essential features
- Clean, professional code following React best practices
