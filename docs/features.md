# Timey Features

## Client App (Electron)

- **Player Profile:** Tracks user progress including XP, level, and history.
  - XP System: Gain XP for completing daily objectives (chores).
  - Leveling System: Level up based on accumulated XP.
  - History Tracking: Records daily progress, including XP earned, play sessions, and chore completion.
- **Daily Objectives (Chores):** Users must complete assigned chores to earn XP.
  - Chore List: Displays daily chores assigned by an administrator.
  - Chore Status Tracking: Mark chores as complete, incomplete, or N/A.
  - Penalties: Incur XP penalties for incomplete chores at the end of the day.
- **Timer System:** Manages play time and cooldown periods.
  - Play Timer: A configurable timer limits daily play time.
  - Cooldown Timer: A period after play time expires before the next session can begin.
  - Timer Notifications: Audio and visual notifications when play time ends.
- **Rewards System:** Users can earn and spend reward points.
  - Earn Rewards: Gain reward points upon leveling up.
  - Spend Rewards: Use points to acquire permanent bonuses (e.g., extended play time, reduced cooldown).
  - Rewards Panel: Interface to view available rewards and purchase bonuses.
- **Firebase Integration:**
  - Authentication: Secure login using Firebase Authentication.
  - Real-time Database: Player profiles are stored and synced in real-time using Firestore.
- **User Interface:**
  - Dark Mode: Application uses a dark theme.
  - Draggable Window: Custom title bar allows window dragging.
  - Clock Display: Shows the current date and time.
  - History Panel: View past daily performance.
  - XP Bar & Level Indicator: Visual representation of progress.

## Admin Site (Next.js)

- **User Profile Management:** View and manage user profiles stored in Firebase.
  - List Users: Display a list of all registered user profiles.
  - View Profile Details: Inspect individual user profiles, including history, XP, level, and rewards.
  - View Daily History: Drill down into specific days to see play sessions, chores completed, and XP breakdown.
  - Assign/Manage Chores: *[Future/Implied Feature]* Administrators can define and assign chores to users (functionality exists in client for using chores, admin UI part might be needed).
- **Authentication:** Secure login for administrators (likely Firebase Auth).
- **Technology Stack:** Built with Next.js, React, TypeScript, Tailwind CSS, and Firebase.
- **Dashboard View:** *[Future/Implied Feature]* Potential for displaying overall system statistics.

## Tools (CLI)

- **Profile Migration (`migrateProfile.ts`, `migrateProfile.sh`):** Scripts to migrate user profile data structures in Firebase.
- **Chore ID Migration (`migrateToCUUIDs.ts`, `migrateToCUUIDs.sh`):** Scripts to migrate chore identifiers to CUUID format.
- **Profile Downloader (`downloadProfile.ts`, `downloadProfile.sh`):** Scripts to download a specific user profile from Firebase for inspection or backup.
- **Firebase Service Account Setup (`SERVICE_ACCOUNT_STEPS.md`):** Documentation guiding the setup of a Firebase service account necessary for running the tools.
