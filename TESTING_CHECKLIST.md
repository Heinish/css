# CSS Dashboard - Testing Checklist

Use this checklist to verify all dashboard features are working correctly with real Raspberry Pis.

## Prerequisites
- [ ] Dashboard installed and running (npm start)
- [ ] At least one Raspberry Pi with CSS agent installed and online
- [ ] Pi responding to http://{pi-ip}:5000/api/status

---

## 🖥️ Basic Dashboard UI

### Header & Layout
- [ ] Dashboard shows title "🖥️ CSS Dashboard"
- [ ] Subtitle shows correct Pi count ("Managing X Raspberry Pi(s)")
- [ ] Main content area displays properly
- [ ] Toolbar is visible with all buttons
- [ ] UI has gradient backgrounds and vibrant colors
- [ ] Loading spinner shows on startup

### Toolbar Actions
- [ ] "➕ Add Pi" button is visible
- [ ] "🏢 Manage Rooms" button is visible
- [ ] "🔄 Refresh" button is visible
- [ ] Room filter dropdown is visible on right side
- [ ] Refresh button shows "⏳ Refreshing..." when clicked
- [ ] Auto-refresh works every 30 seconds

---

## ➕ Adding Pis

### Add Pi Dialog
- [ ] Clicking "➕ Add Pi" opens modal dialog
- [ ] Dialog has "Pi Name" input field
- [ ] Dialog has "IP Address" required field
- [ ] Can enter custom Pi name (e.g., "Office Display")
- [ ] Can enter IP address (e.g., "192.168.10.105")
- [ ] "Cancel" button closes dialog without saving
- [ ] "Add Pi" button adds Pi to dashboard
- [ ] Added Pi appears in grid immediately
- [ ] Click outside modal closes dialog
- [ ] Name defaults to "Pi-{IP}" if left blank

### After Adding
- [ ] Pi card appears in the grid
- [ ] Pi status fetches automatically after adding
- [ ] Pi shows online/offline status correctly
- [ ] Error message if Pi unreachable or already exists

---

## 📊 Pi Card Display

### Status Indicators
- [ ] Online Pis show ✅ with green dot
- [ ] Offline Pis show ❌ with red dot
- [ ] Green dot pulses/animates when online
- [ ] Card has colored left border (green=online, red=offline)
- [ ] Card has gradient background

### Pi Information
- [ ] Pi name displays prominently
- [ ] IP address shows in monospace font
- [ ] Room badge displays if Pi assigned to room (📍 Room Name)
- [ ] Room badge has purple/pink gradient background

### Pi Statistics (Online Only)
- [ ] 💻 CPU usage percentage displays
- [ ] 💾 Memory usage percentage displays
- [ ] 🌡️ Temperature in Celsius displays (if available)
- [ ] Stats have gradient background box
- [ ] Stats update on refresh

### Current URL Display
- [ ] Shows "🌐 URL: {url}" for online Pis
- [ ] Long URLs are truncated with "..."
- [ ] URL updates after URL change command

### Card Interactions
- [ ] Card hover effect works (lifts up, shadow increases)
- [ ] Card has smooth transitions

---

## 🔗 URL Management

### Change URL Dialog
- [ ] Clicking "🔗 Change URL" opens modal
- [ ] Modal shows current URL pre-filled
- [ ] Can enter new URL (e.g., https://google.com)
- [ ] "Cancel" button closes without changing
- [ ] "Change URL" button submits change
- [ ] Button disabled when Pi is offline
- [ ] Button shows "⏳ Changing..." during operation

### URL Change Result
- [ ] Success: Shows "✅ URL changed successfully!" alert
- [ ] Success: Dashboard refreshes after 500ms to show new URL
- [ ] Failure: Shows "❌ Failed to change URL: {error}" alert
- [ ] Pi's current_url updates after successful change

---

## 🔄 Browser & System Control

### Restart Browser
- [ ] "🔄 Restart" button visible on Pi card
- [ ] Button disabled when Pi is offline
- [ ] Clicking shows confirmation (no dialog, immediate action)
- [ ] Button shows "⏳ Restarting..." during operation
- [ ] Success: Shows "🔄 Browser restarted successfully!" alert
- [ ] Failure: Shows "❌ Failed to restart browser: {error}" alert
- [ ] Button re-enables after operation completes

### Reboot Pi
- [ ] "⚡ Reboot" button visible with warning color
- [ ] Button disabled when Pi is offline
- [ ] Clicking shows confirmation: "⚡ Reboot this Pi? It will be offline for ~30 seconds."
- [ ] Button shows "⏳ Rebooting..." during operation
- [ ] Success: Shows "⚡ Pi is rebooting! It will be back online in ~30 seconds." alert
- [ ] Failure: Shows "❌ Failed to reboot Pi: {error}" alert
- [ ] Pi status changes to offline after reboot
- [ ] Pi comes back online after ~30 seconds

---

## ⚙️ Pi Settings Dialog

### Opening Settings
- [ ] "⚙️ Settings" button visible on each Pi card
- [ ] Clicking opens large modal dialog
- [ ] Modal title shows "⚙️ Settings - {Pi Name}"
- [ ] Three tabs visible: "📋 General", "📺 Display", "🌐 Network"
- [ ] Click outside modal closes dialog

### General Tab
- [ ] Tab is active by default
- [ ] Shows "✏️ Pi Name:" input with current name
- [ ] Can edit Pi name
- [ ] Shows "🏢 Room:" dropdown
- [ ] Dropdown includes "No Room" option
- [ ] Dropdown lists all available rooms
- [ ] Shows current room pre-selected
- [ ] "Cancel" button closes without saving
- [ ] "💾 Save" button saves changes
- [ ] Success: Shows "✅ Settings saved!" alert
- [ ] Modal closes after successful save
- [ ] Pi name updates in card immediately
- [ ] Room badge appears/updates if room changed
- [ ] Dashboard refreshes to show updates

### Display Tab
- [ ] Tab switches when clicked
- [ ] Tab content animates in smoothly

#### Screenshot Preview
- [ ] Section header: "📸 Screenshot Preview"
- [ ] Description text visible
- [ ] "📸 Show Preview" button visible
- [ ] Button disabled when Pi is offline
- [ ] Clicking shows "⏳ Loading..." on button
- [ ] Success: Opens new modal with screenshot image
- [ ] Screenshot displays full width with rounded corners
- [ ] Screenshot modal has title "📸 Live Preview - {Pi Name}"
- [ ] "Close" button closes screenshot modal
- [ ] Click outside closes screenshot modal
- [ ] Failure: Shows "❌ Failed to get screenshot: {error}" alert
- [ ] Screenshot requires grim or scrot installed on Pi

#### Screen Rotation
- [ ] Section header: "🔄 Screen Rotation"
- [ ] Description mentions reboot requirement
- [ ] Dropdown shows 4 rotation options:
  - [ ] 0° (Normal)
  - [ ] 90° (Clockwise)
  - [ ] 180° (Upside Down)
  - [ ] 270° (Counter-Clockwise)
- [ ] Dropdown disabled when Pi offline
- [ ] "✅ Apply Rotation" button visible
- [ ] Button disabled when Pi offline
- [ ] Success: Shows "✅ Screen rotated successfully! Reboot required to apply." alert
- [ ] Failure: Shows "❌ Failed to rotate screen: {error}" alert
- [ ] Rotation takes effect after Pi reboot

### Network Tab
- [ ] Tab switches when clicked
- [ ] Warning alert visible: "⚠️ Warning: Changing network settings..."
- [ ] Shows current IP address (disabled input)
- [ ] Info alert: "🔧 Network configuration feature coming in next update..."
- [ ] "Close" button closes modal

---

## 🏢 Room Management

### Room Filter
- [ ] Dropdown in toolbar shows "🏢 Filter:"
- [ ] Dropdown includes "All Rooms" option by default
- [ ] Lists all created rooms
- [ ] Selecting "All Rooms" shows all Pis
- [ ] Selecting a specific room filters Pis to only that room
- [ ] Empty room shows: "🏢 No Pis in this room."
- [ ] Filter persists during session

### Manage Rooms Dialog
- [ ] Clicking "🏢 Manage Rooms" opens modal
- [ ] Modal title: "🏢 Manage Rooms"

#### Existing Rooms List
- [ ] Section header: "Existing Rooms:"
- [ ] Lists all rooms in styled boxes
- [ ] Each room has name and "🗑️ Delete" button
- [ ] Hovering room item changes background color

#### Add Room
- [ ] Section header: "➕ Add New Room:"
- [ ] Input field for new room name
- [ ] Placeholder: "e.g., Conference Room A"
- [ ] Input has autofocus when dialog opens
- [ ] "Close" button closes modal
- [ ] "➕ Add Room" button adds new room
- [ ] Button disabled when input is empty
- [ ] Success: Room appears in list immediately
- [ ] Success: Input field clears after adding
- [ ] Failure: Shows "❌ Failed to add room: {error}" alert
- [ ] New room appears in filter dropdown immediately

#### Delete Room
- [ ] Clicking "🗑️ Delete" shows confirmation: "🗑️ Delete this room? Pis will be unassigned."
- [ ] Confirming deletes room
- [ ] Room removed from list immediately
- [ ] Room removed from filter dropdown
- [ ] Pis in that room become unassigned
- [ ] Dashboard refreshes to update Pi room badges
- [ ] Failure: Shows "❌ Failed to remove room: {error}" alert

---

## 🗑️ Remove Pi

### Remove Action
- [ ] "🗑️ Remove" button visible on each Pi card
- [ ] Button has red/danger styling
- [ ] Clicking shows confirmation: "Remove this Pi from the dashboard?"
- [ ] Confirming removes Pi from dashboard
- [ ] Pi card disappears immediately
- [ ] Pi removed from database
- [ ] Failure: Shows "Failed to remove Pi: {error}" alert
- [ ] Cancel keeps Pi in dashboard

---

## 🎨 UI Polish & UX

### Emojis
- [ ] All buttons have appropriate emojis
- [ ] Header has 🖥️ emoji
- [ ] Status uses ✅/❌ emojis
- [ ] Stats have 💻, 💾, 🌡️ emojis
- [ ] Room badge has 📍 emoji
- [ ] Tabs have emojis (📋, 📺, 🌐)
- [ ] Actions have emojis (🔗, 🔄, ⚡, ⚙️, 🗑️)

### Colors & Gradients
- [ ] Header has purple-pink gradient
- [ ] Header has shimmer animation
- [ ] Toolbar has gradient background
- [ ] Pi cards have subtle gradient
- [ ] Online Pi has green accent
- [ ] Offline Pi has red accent
- [ ] Buttons have gradient backgrounds
- [ ] Buttons have shadow effects
- [ ] Modal backgrounds have gradients
- [ ] Room badges have purple gradient
- [ ] Stats boxes have gradient backgrounds

### Animations & Transitions
- [ ] Online status dot pulses
- [ ] Cards lift on hover
- [ ] Cards scale slightly on hover
- [ ] Shadow increases on hover
- [ ] Buttons lift on hover
- [ ] Modals fade in smoothly
- [ ] Modals slide up on open
- [ ] Tab content fades in when switching
- [ ] Loading spinner rotates smoothly
- [ ] All transitions are smooth (no jank)

### Responsive Design
- [ ] Dashboard works on different window sizes
- [ ] Cards reflow in grid properly
- [ ] Toolbar stacks on narrow windows
- [ ] Scrollbars styled with custom colors
- [ ] Modal fits on screen with scrolling if needed

---

## ⚡ Performance & Reliability

### Data Persistence
- [ ] Added Pis persist after closing dashboard
- [ ] Room assignments persist after closing
- [ ] Pi names persist after editing
- [ ] Database file created in correct location

### Auto-Refresh
- [ ] Status updates automatically every 30 seconds
- [ ] Auto-refresh doesn't interrupt user input
- [ ] Refresh indicator shows during update
- [ ] Failed refreshes don't break dashboard

### Error Handling
- [ ] Offline Pis show error state clearly
- [ ] Network timeouts handled gracefully
- [ ] Invalid IP addresses show error message
- [ ] Duplicate IPs rejected with error
- [ ] All errors show user-friendly messages
- [ ] Dashboard doesn't crash on API errors

### Network Communication
- [ ] All HTTP requests go through IPC (CSP compliant)
- [ ] Requests timeout after reasonable time
- [ ] Loading states show for all async operations
- [ ] Multiple concurrent requests handled correctly

---

## 🔧 Edge Cases

### Empty States
- [ ] No Pis: Shows "🎯 No Pis added yet. Click '➕ Add Pi' to get started!"
- [ ] No rooms: Manage Rooms dialog shows only Add section
- [ ] Filtered room empty: Shows "🏢 No Pis in this room."

### Invalid Inputs
- [ ] Add Pi without IP shows "IP address required!"
- [ ] Add Pi with invalid IP format (test behavior)
- [ ] Add Pi with unreachable IP (shows offline)
- [ ] Add room with empty name (button disabled)
- [ ] Change URL to invalid URL (test Pi response)

### Concurrent Operations
- [ ] Can't click action buttons while operation in progress
- [ ] Multiple Pis can be managed simultaneously
- [ ] Refresh during other operations doesn't cause issues

### Long Content
- [ ] Long Pi names wrap or truncate properly
- [ ] Long URLs truncate with "..."
- [ ] Long room names display correctly
- [ ] Many Pis in grid scroll properly
- [ ] Many rooms in dropdown scroll properly

---

## 🚀 Advanced Features (Coming Soon)

### Bulk Actions (Not Yet Implemented)
- [ ] Select multiple Pis with checkboxes
- [ ] Bulk URL change to multiple Pis
- [ ] Bulk restart browser on multiple Pis
- [ ] Bulk reboot multiple Pis
- [ ] Bulk assign to room

### Global Settings (Not Yet Implemented)
- [ ] Configure daily reboot time
- [ ] Enable/disable auto-updates
- [ ] Update Now button for immediate git pull
- [ ] Configure auto-refresh interval

---

## 📋 Testing Notes

### Test Pi Information
- Pi 1 Name: ________________
- Pi 1 IP: ________________
- Pi 1 Status: ⬜ Online ⬜ Offline

- Pi 2 Name: ________________
- Pi 2 IP: ________________
- Pi 2 Status: ⬜ Online ⬜ Offline

### Issues Found
1. ________________________________________________________________
2. ________________________________________________________________
3. ________________________________________________________________

### Features Working Perfectly
1. ________________________________________________________________
2. ________________________________________________________________
3. ________________________________________________________________

---

**Testing Date:** ________________
**Tester:** ________________
**Dashboard Version:** ________________
**Notes:** ________________________________________________________________

