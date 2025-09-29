# Ticket System Setup Guide

This document outlines the Parse class structure needed to implement the ticket system functionality.

## Parse Classes Required

### 1. Ticket Class

Create a new class in Back4App called `Ticket` with the following fields:

| Field Name | Type | Description |
|------------|------|-------------|
| title | String | The title of the ticket |
| description | String | Detailed description of the issue |
| category | String | Category of the ticket (Hardware, Software, Network, Access, Other) |
| priority | String | Priority level (low, medium, high, critical) |
| status | String | Current status (open, in-progress, resolved, closed) |
| tags | Array | Optional tags for the ticket |
| dueDate | Date | Optional due date for the ticket |
| resolution | String | Description of how the ticket was resolved |
| createdBy | Pointer to _User | User who created the ticket |
| assignedTo | Pointer to _User | User assigned to resolve the ticket |

### 2. TicketComment Class

Create a new class called `TicketComment` with the following fields:

| Field Name | Type | Description |
|------------|------|-------------|
| ticket | Pointer to Ticket | The ticket this comment belongs to |
| text | String | The comment text |
| createdBy | Pointer to _User | User who created the comment |

## Cloud Functions to Implement

Add these cloud functions to your Back4App application:

### 1. Get Ticket Statistics

```javascript
// Get ticket statistics for dashboard
Parse.Cloud.define('getTicketStats', async (request) => {
  const { user } = request;
  if (!user) {
    throw new Error('User must be authenticated');
  }
  
  const Ticket = Parse.Object.extend('Ticket');
  const query = new Parse.Query(Ticket);
  
  // If not admin, only get stats for user's tickets
  if (user.get('role') !== 'admin') {
    query.equalTo('createdBy', user);
  }
  
  const tickets = await query.find({ useMasterKey: true });
  
  // Count tickets by status
  const openCount = tickets.filter(t => t.get('status') === 'open').length;
  const inProgressCount = tickets.filter(t => t.get('status') === 'in-progress').length;
  const resolvedCount = tickets.filter(t => t.get('status') === 'resolved').length;
  const closedCount = tickets.filter(t => t.get('status') === 'closed').length;
  
  // Count tickets resolved today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const resolvedToday = tickets.filter(t => {
    const updatedAt = t.updatedAt;
    return t.get('status') === 'resolved' && 
           updatedAt >= today;
  }).length;
  
  // Calculate average resolution time (for resolved tickets)
  let totalResolutionTimeHours = 0;
  let resolvedTicketsCount = 0;
  
  tickets.forEach(ticket => {
    if (ticket.get('status') === 'resolved') {
      const createdAt = ticket.createdAt;
      const updatedAt = ticket.updatedAt;
      const diffHours = (updatedAt - createdAt) / (1000 * 60 * 60);
      totalResolutionTimeHours += diffHours;
      resolvedTicketsCount++;
    }
  });
  
  const avgResolutionTime = resolvedTicketsCount > 0 
    ? (totalResolutionTimeHours / resolvedTicketsCount).toFixed(1) 
    : 0;
  
  return {
    openCount,
    inProgressCount,
    resolvedCount,
    closedCount,
    resolvedToday,
    avgResolutionTime
  };
});
```

## Security Settings

### Class-Level Permissions

Configure these class-level permissions in Back4App:

1. **Ticket Class**:
   - Public read access: Off
   - Public write access: Off
   - Require authentication: On
   - Role-based permissions:
     - Admin role: Full access
     - User role: Create, Read (their own tickets)

2. **TicketComment Class**:
   - Public read access: Off
   - Public write access: Off
   - Require authentication: On
   - Role-based permissions:
     - Admin role: Full access
     - User role: Create, Read (comments on their tickets)

### ACL (Access Control Lists)

In the ticket creation service, set up ACLs to ensure proper access control:

```javascript
// When creating a ticket
const acl = new Parse.ACL(currentUser);
// Allow admins to read/write
const adminRole = await new Parse.Query(Parse.Role).equalTo('name', 'admin').first();
if (adminRole) {
  acl.setRoleReadAccess(adminRole, true);
  acl.setRoleWriteAccess(adminRole, true);
}
ticket.setACL(acl);
```

## Implementation Steps

1. Create the classes in Back4App dashboard
2. Set up the class-level permissions
3. Add the cloud functions to your Back4App application
4. Implement the front-end components (already done)
5. Test the functionality with real users

## Testing

After setting up the classes and cloud functions, test the system with these scenarios:

1. Create a ticket as a regular user
2. View tickets as an admin
3. Assign a ticket to a user
4. Update a ticket status
5. Add comments to a ticket
6. Verify statistics are calculated correctly

This setup will provide a complete ticket management system with proper security and functionality for both administrators and regular users. 