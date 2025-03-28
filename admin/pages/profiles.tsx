import React, { useState, useEffect } from "react";
import type { NextPage } from "next";
import Head from "next/head";
import Layout from "../components/Layout";
import { PlayerProfile, ChoreStatus } from "../../src/playerProfile";
import { db, auth } from "../utils/firebase";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { APP_CONFIG } from "../utils/appConfig";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";

// Interface for admin view (only adding what we need on top of PlayerProfile)
interface AdminUserProfile extends PlayerProfile {
  uid: string;
  xp?: { final: number; base: number; bonus: number };
  playTime?: { sessions: any[] };
  lastUpdated?: string; // Add this field to track changes
}

// Interface for a chore item
interface ChoreItem {
  id: number;
  text: string;
  status?: ChoreStatus;
  completedAt?: string;
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

const ProfilesPage: NextPage = () => {
  const [profiles, setProfiles] = useState<AdminUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [expandedProfiles, setExpandedProfiles] = useState<
    Record<string, boolean>
  >({});
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // Chores modal state
  const [isChoresModalOpen, setIsChoresModalOpen] = useState(false);
  const [selectedProfileUid, setSelectedProfileUid] = useState<string | null>(
    null
  );
  const [userChores, setUserChores] = useState<ChoreItem[]>([]);
  const [newChoreText, setNewChoreText] = useState("");
  const [editingChoreId, setEditingChoreId] = useState<number | null>(null);
  const [editingChoreText, setEditingChoreText] = useState("");
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([
    0, 1, 2, 3, 4, 5, 6,
  ]); // Default to all days
  const [editingDaysOfWeek, setEditingDaysOfWeek] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Check auth state on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in
        setIsAuthenticated(true);
      } else {
        // User is signed out
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Toggle profile expansion
  const toggleProfileExpansion = (uid: string) => {
    setExpandedProfiles((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  // Toggle day expansion
  const toggleDayExpansion = (uid: string, date: string) => {
    const dayKey = `${uid}-${date}`;
    setExpandedDays((prev) => ({
      ...prev,
      [dayKey]: !prev[dayKey],
    }));
  };

  // Get status icon for chore status
  const getStatusIcon = (
    status: ChoreStatus
  ): { icon: string; color: string } => {
    switch (status) {
      case "completed":
        return { icon: "✓", color: "text-green-400" };
      case "na":
        return { icon: "N/A", color: "text-gray-400" };
      case "incomplete":
        return { icon: "✗", color: "text-red-400" };
      default:
        return { icon: "✗", color: "text-red-400" };
    }
  };

  // Calculate level and XP from profile history
  const calculatePlayerStats = (profile: PlayerProfile) => {
    let totalXp = 0;

    // Sum up all final XP from history
    Object.values(profile.history || {}).forEach((day) => {
      if (day.xp && day.xp.final) {
        totalXp += day.xp.final;
      }
    });

    // Get XP thresholds from app config
    const xpPerLevel = APP_CONFIG.PROFILE.XP_PER_LEVEL;
    const defaultXpPerLevel = APP_CONFIG.PROFILE.DEFAULT_XP_PER_LEVEL;

    // Calculate cumulative XP thresholds
    const cumulativeThresholds: number[] = [];
    let cumulativeXp = 0;

    // Build cumulative thresholds (how much total XP is needed for each level)
    for (let i = 0; i < xpPerLevel.length; i++) {
      cumulativeXp += xpPerLevel[i];
      cumulativeThresholds.push(cumulativeXp);
    }

    // Find current level based on total XP
    let level = 1;
    for (let i = 0; i < cumulativeThresholds.length; i++) {
      if (totalXp < cumulativeThresholds[i]) {
        level = i + 1; // Level is 1-indexed
        break;
      }

      // If we've passed all thresholds, calculate higher level
      if (
        i === cumulativeThresholds.length - 1 &&
        totalXp >= cumulativeThresholds[i]
      ) {
        const extraXp = totalXp - cumulativeThresholds[i];
        const additionalLevels = Math.floor(extraXp / defaultXpPerLevel);
        level = xpPerLevel.length + 1 + additionalLevels;
      }
    }

    // Calculate XP progress toward next level
    let currentLevelThreshold = 0;
    let nextLevelThreshold = cumulativeThresholds[0];

    if (level > 1) {
      if (level <= cumulativeThresholds.length) {
        // For levels within the predefined thresholds
        currentLevelThreshold = cumulativeThresholds[level - 2] || 0;
        nextLevelThreshold = cumulativeThresholds[level - 1];
      } else {
        // For levels beyond the predefined thresholds
        const baseXp = cumulativeThresholds[cumulativeThresholds.length - 1];
        const levelsAboveMax = level - (cumulativeThresholds.length + 1);
        currentLevelThreshold = baseXp + levelsAboveMax * defaultXpPerLevel;
        nextLevelThreshold = currentLevelThreshold + defaultXpPerLevel;
      }
    }

    const xpInCurrentLevel = totalXp - currentLevelThreshold;
    const xpRequiredForNextLevel = nextLevelThreshold - currentLevelThreshold;

    return {
      level,
      xp: xpInCurrentLevel,
      totalXp,
      xpToNextLevel: xpRequiredForNextLevel,
    };
  };

  // Calculate play session statistics
  const calculatePlayStats = (dayData: PlayerProfile["history"][string]) => {
    if (
      !dayData.playTime ||
      !dayData.playTime.sessions ||
      dayData.playTime.sessions.length === 0
    ) {
      return { totalPlayTime: 0, totalSessions: 0, formattedPlayTime: "0:00" };
    }

    let totalPlayTimeMs = 0;
    const totalSessions = dayData.playTime.sessions.length;

    dayData.playTime.sessions.forEach((session) => {
      if (session.start && session.end) {
        const startTime = new Date(session.start).getTime();
        const endTime = new Date(session.end).getTime();
        totalPlayTimeMs += endTime - startTime;
      }
    });

    // Convert milliseconds to minutes
    const totalPlayMinutes = Math.floor(totalPlayTimeMs / (1000 * 60));

    // Format as hours:minutes
    const hours = Math.floor(totalPlayMinutes / 60);
    const minutes = totalPlayMinutes % 60;
    const formattedPlayTime = `${hours}:${minutes.toString().padStart(2, "0")}`;

    return {
      totalPlayTime: totalPlayMinutes,
      totalSessions,
      formattedPlayTime,
    };
  };

  // Calculate aggregate stats for a profile
  const calculateAggregateStats = (profile: PlayerProfile) => {
    let totalPlayTime = 0;
    let totalSessions = 0;
    let totalChores = 0;
    let completedChores = 0;

    Object.values(profile.history || {}).forEach((day) => {
      // Count play sessions
      if (day.playTime?.sessions) {
        totalSessions += day.playTime.sessions.length;

        // Calculate total play time
        day.playTime.sessions.forEach((session) => {
          if (session.start && session.end) {
            const startTime = new Date(session.start).getTime();
            const endTime = new Date(session.end).getTime();
            totalPlayTime += endTime - startTime;
          }
        });
      }

      // Count chores
      if (day.chores) {
        totalChores += day.chores.length;
        completedChores += day.chores.filter(
          (chore) => chore.status === "completed"
        ).length;
      }
    });

    // Convert milliseconds to minutes
    const totalPlayMinutes = Math.floor(totalPlayTime / (1000 * 60));

    // Format as hours:minutes
    const hours = Math.floor(totalPlayMinutes / 60);
    const minutes = totalPlayMinutes % 60;
    const formattedPlayTime = `${hours}:${minutes.toString().padStart(2, "0")}`;

    // Calculate chore completion percentage
    const choreCompletionRate =
      totalChores > 0 ? Math.round((completedChores / totalChores) * 100) : 0;

    return {
      totalPlayMinutes,
      formattedPlayTime,
      totalSessions,
      totalChores,
      completedChores,
      choreCompletionRate,
    };
  };

  // Calculate chore completion for a day
  const calculateDayChoreStats = (
    dayData: PlayerProfile["history"][string]
  ) => {
    if (!dayData.chores || dayData.chores.length === 0) {
      return { total: 0, completed: 0, completionRate: 0 };
    }

    const total = dayData.chores.length;
    const completed = dayData.chores.filter(
      (chore) => chore.status === "completed"
    ).length;
    const completionRate = Math.round((completed / total) * 100);

    return { total, completed, completionRate };
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // No need to set isAuthenticated here as onAuthStateChanged will handle it
    } catch (error: FirebaseError | unknown) {
      console.error("Authentication error:", error);
      const errorMessage =
        error instanceof FirebaseError ? error.message : "Unknown error";
      setError(`Authentication failed: ${errorMessage}`);
      setLoading(false);
    }
  };

  // Use real-time listener instead of one-time fetch
  const fetchProfilesRealtime = () => {
    try {
      const profilesCollection = collection(db, "playerProfiles");

      // Set up real-time listener
      const unsubscribe = onSnapshot(
        profilesCollection,
        (snapshot) => {
          const profilesData: AdminUserProfile[] = [];

          snapshot.forEach((doc) => {
            const profileData = doc.data() as PlayerProfile;

            profilesData.push({
              uid: doc.id,
              ...profileData,
            });
          });

          setProfiles(profilesData);
          setLoading(false);
        },
        (error) => {
          console.error("Error listening to profiles:", error);
          setError("Failed to sync user profiles in real-time");
          setLoading(false);
        }
      );

      // Return unsubscribe function for cleanup
      return unsubscribe;
    } catch (error) {
      console.error("Error setting up profiles listener:", error);
      setError("Failed to set up real-time sync");
      setLoading(false);
      // Return a no-op function that satisfies the type requirement
      return () => {
        // No operation needed in the fallback case
        console.log("No Firebase listener to unsubscribe from");
      };
    }
  };

  // Effect to clean up the listener when component unmounts
  useEffect(() => {
    let unsubscribeProfiles: () => void;

    if (isAuthenticated) {
      unsubscribeProfiles = fetchProfilesRealtime();
    }

    return () => {
      if (unsubscribeProfiles) {
        unsubscribeProfiles();
      }
    };
  }, [isAuthenticated]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Auth state listener will update the state
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Open chores modal for a specific profile
  const openChoresModal = (profile: AdminUserProfile) => {
    setSelectedProfileUid(profile.uid);

    // ALWAYS use base chores from the profile first, not today's history
    // This ensures we see ALL chores including those scheduled for other days
    if (profile.chores && profile.chores.length > 0) {
      // Initialize with profile's base chores and set default status
      const choresWithStatus = profile.chores.map((chore) => {
        // Create a properly typed chore with status
        const typedChore: ChoreItem = {
          id: chore.id,
          text: chore.text,
          status: "incomplete" as ChoreStatus,
          daysOfWeek: chore.daysOfWeek || [0, 1, 2, 3, 4, 5, 6], // Default to all days if not specified
        };
        return typedChore;
      });
      setUserChores(choresWithStatus);
    } else {
      // If no chores defined yet in the profile, start with empty array
      setUserChores([]);
    }

    setIsChoresModalOpen(true);
  };

  // Reset days of week selection
  const resetDaysOfWeek = () => {
    setSelectedDaysOfWeek([0, 1, 2, 3, 4, 5, 6]); // Default to all days
  };

  // Toggle day of week selection
  const toggleDaySelection = (day: number) => {
    if (selectedDaysOfWeek.includes(day)) {
      // Don't allow removing the last day
      if (selectedDaysOfWeek.length > 1) {
        setSelectedDaysOfWeek(selectedDaysOfWeek.filter((d) => d !== day));
      }
    } else {
      setSelectedDaysOfWeek([...selectedDaysOfWeek, day].sort((a, b) => a - b));
    }
  };

  // Toggle day of week selection during editing
  const toggleEditDaySelection = (day: number) => {
    if (editingDaysOfWeek.includes(day)) {
      // Don't allow removing the last day
      if (editingDaysOfWeek.length > 1) {
        setEditingDaysOfWeek(editingDaysOfWeek.filter((d) => d !== day));
      }
    } else {
      setEditingDaysOfWeek([...editingDaysOfWeek, day].sort((a, b) => a - b));
    }
  };

  // Close chores modal and reset state
  const closeChoresModal = () => {
    setIsChoresModalOpen(false);
    setSelectedProfileUid(null);
    setUserChores([]);
    setNewChoreText("");
    setEditingChoreId(null);
    setEditingChoreText("");
    resetDaysOfWeek();
    setEditingDaysOfWeek([]);
  };

  // Add a new chore
  const handleAddChore = () => {
    if (!newChoreText.trim()) return;

    // Find the next available ID by getting the max ID from existing chores and adding 1
    const newId =
      userChores.length > 0
        ? Math.max(...userChores.map((chore) => chore.id)) + 1
        : 0;

    // Add a new chore with default "incomplete" status and selected days of week
    setUserChores([
      ...userChores,
      {
        id: newId,
        text: newChoreText.trim(),
        status: "incomplete" as ChoreStatus,
        daysOfWeek: [...selectedDaysOfWeek], // Add selected days of week
      },
    ]);

    setNewChoreText("");
    resetDaysOfWeek(); // Reset days selection after adding
  };

  // Start editing a chore
  const startEditChore = (chore: ChoreItem) => {
    setEditingChoreId(chore.id);
    setEditingChoreText(chore.text);
    setEditingDaysOfWeek(chore.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]);
  };

  // Save chore edit
  const saveChoreEdit = () => {
    if (!editingChoreText.trim() || editingChoreId === null) return;

    setUserChores(
      userChores.map((chore) =>
        chore.id === editingChoreId
          ? {
              ...chore,
              text: editingChoreText.trim(),
              daysOfWeek: [...editingDaysOfWeek],
            }
          : chore
      )
    );

    setEditingChoreId(null);
    setEditingChoreText("");
    setEditingDaysOfWeek([]);
  };

  // Delete a chore
  const deleteChore = (id: number) => {
    setUserChores(userChores.filter((chore) => chore.id !== id));
  };

  // Function to check if a chore should appear on a specific day
  const shouldChoreAppearOnDay = (chore: ChoreItem, date: string): boolean => {
    // If no days of week specified, show on all days
    if (!chore.daysOfWeek || chore.daysOfWeek.length === 0) {
      return true;
    }

    // Get day of week (0-6) from the date string
    // Use local timezone to avoid date conversion issues
    const dateParts = date.split("-").map((part) => parseInt(part, 10));
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]); // Month is 0-indexed
    const dayOfWeek = dateObj.getDay();

    // Check if the day of week is in the chore's daysOfWeek array
    return chore.daysOfWeek.includes(dayOfWeek);
  };

  // Format day name helper
  const getDayName = (day: number): string => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[day];
  };

  // Get today's date and day of week in a reliable way
  const getTodayInfo = (): { dateString: string; dayOfWeek: number } => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0"); // +1 because months are 0-indexed
    const day = String(today.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${day}`;
    const dayOfWeek = today.getDay();

    return { dateString, dayOfWeek };
  };

  // Save chores to Firestore
  const saveChores = async () => {
    if (!selectedProfileUid) return;

    setIsSaving(true);
    try {
      // Use our reliable date function instead of relying on Date().toISOString()
      const { dateString: currentDate, dayOfWeek } = getTodayInfo();

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(currentDate)) {
        console.error("Invalid date format:", currentDate);
        throw new Error(
          `Invalid date format: ${currentDate}, expected YYYY-MM-DD`
        );
      }

      const profileRef = doc(db, "playerProfiles", selectedProfileUid);

      // Find the profile we're updating
      const selectedProfile = profiles.find(
        (p) => p.uid === selectedProfileUid
      );

      if (!selectedProfile) {
        throw new Error("Profile not found");
      }

      console.log("Selected profile:", selectedProfile); // Add logging to check profile
      console.log("Current date:", currentDate);

      // Filter chores that should appear today based on daysOfWeek
      const choresTodayFiltered = userChores.filter((chore) =>
        shouldChoreAppearOnDay(chore, currentDate)
      );

      // Get existing chores for today to preserve their status
      const existingChores =
        (selectedProfile.history &&
          selectedProfile.history[currentDate]?.chores) ||
        [];

      // Make sure we create properly structured chore objects with no undefined values
      const choresWithStatus = choresTodayFiltered.map((chore) => {
        // Find existing chore with same id to preserve its status
        const existingChore = existingChores.find((c) => c.id === chore.id);

        // Create a clean chore object with only the properties we need
        return {
          id: chore.id,
          text: chore.text,
          // Keep existing status if available, otherwise use default
          status:
            existingChore?.status ||
            chore.status ||
            ("incomplete" as ChoreStatus),
          // Keep existing completedAt if available
          ...(existingChore?.completedAt
            ? { completedAt: existingChore.completedAt }
            : chore.completedAt
            ? { completedAt: chore.completedAt }
            : {}),
        };
      });

      // Create default profile values if they don't exist
      const defaultXp = {
        final: 0,
        base: 0,
        bonus: 0,
        gained: 0,
        penalties: 0,
      };
      const defaultPlayTime = { sessions: [] };
      const defaultRewards = { available: 0, permanent: {} };

      // Ensure history exists
      const history = selectedProfile.history || {};

      console.log("History object:", history);
      console.log(
        "Checking if history[currentDate] exists:",
        history[currentDate]
      );

      // Create or update today's history with default values
      history[currentDate] = {
        // Include existing day data if any
        ...(history[currentDate] || {}),
        // Make sure date field exists
        date: currentDate,
        // Add default values if they don't exist
        xp: history[currentDate]?.xp || { ...defaultXp },
        playTime: history[currentDate]?.playTime || { ...defaultPlayTime },
        // Always update chores while preserving their status
        chores: choresWithStatus,
        // Make sure completed field exists
        completed: history[currentDate]?.completed || false,
      };

      // Update the base chores list in the profile for future days -
      // IMPORTANT: We save ALL chores here, not just today's chores
      // This is critical to preserve chores for other days of the week
      const baseChores = userChores.map((chore) => ({
        id: chore.id,
        text: chore.text,
        daysOfWeek: chore.daysOfWeek || [0, 1, 2, 3, 4, 5, 6], // Preserve days of week settings
      }));

      // Create a complete profile object with all necessary fields
      const completeProfile = {
        // Keep existing profile data
        ...selectedProfile,
        // Update base chores for future days (without status but with daysOfWeek)
        chores: baseChores,
        // Ensure all required fields exist
        xp: selectedProfile.xp || { ...defaultXp },
        playTime: selectedProfile.playTime || { ...defaultPlayTime },
        rewards: selectedProfile.rewards || { ...defaultRewards },
        // Use the updated history
        history,
        // Add a lastUpdated timestamp to trigger real-time updates
        lastUpdated: new Date().toISOString(),
      };

      console.log("Complete profile to save:", completeProfile);

      // Use setDoc with merge option to ensure complete update with all fields
      // This ensures the entire document is properly structured and avoids partial updates
      await setDoc(profileRef, completeProfile, { merge: true });

      // Update the local profiles state to reflect changes
      setProfiles(
        profiles.map((profile) => {
          if (profile.uid === selectedProfileUid) {
            // Return the complete profile we just saved to Firestore
            return completeProfile as AdminUserProfile;
          }
          return profile;
        })
      );

      closeChoresModal();
    } catch (error) {
      console.error("Error saving chores:", error);
      setError("Failed to save chores");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>User Profiles - Timey Admin</title>
        <meta name="description" content="Manage user profiles in Timey" />
      </Head>

      <div className="bg-[#222] shadow-lg rounded-lg p-6 text-white">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
          <h1 className="text-2xl font-bold text-green-400">
            User Profiles {profiles.length > 0 && `(${profiles.length})`}
          </h1>
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white transition-colors"
            >
              Logout
            </button>
          )}
        </div>

        {!isAuthenticated ? (
          <div className="max-w-md mx-auto bg-[#333] p-6 rounded-lg shadow-md border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-green-400">
              Admin Login
            </h2>
            {error && (
              <div className="bg-[rgba(244,67,54,0.2)] text-red-400 p-3 mb-4 rounded border border-red-900">
                {error}
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-300"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-[#444] border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-white"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-300"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-[#444] border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-white"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        ) : loading ? (
          <div className="flex justify-center items-center h-40">
            <p className="text-lg text-gray-300">Loading profiles...</p>
          </div>
        ) : error ? (
          <div className="bg-[rgba(244,67,54,0.2)] text-red-400 p-4 rounded-md border border-red-900">
            {error}
          </div>
        ) : profiles.length === 0 ? (
          <div className="bg-[rgba(255,152,0,0.2)] text-yellow-300 p-4 rounded-md border border-yellow-900">
            No user profiles found.
          </div>
        ) : (
          <div className="space-y-4">
            {profiles.map((profile) => {
              const playerStats = calculatePlayerStats(profile);
              const aggregateStats = calculateAggregateStats(profile);
              const isExpanded = expandedProfiles[profile.uid] || false;

              return (
                <div
                  key={profile.uid}
                  className={`border border-gray-700 rounded-lg shadow-md bg-[#333] hover:bg-[#3a3a3a] transition duration-150 ${
                    isExpanded ? "p-6" : "p-4"
                  }`}
                >
                  <div
                    className="flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer"
                    onClick={() => toggleProfileExpansion(profile.uid)}
                  >
                    <div className="flex items-center">
                      <div
                        className={`text-green-400 mr-3 transform transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-green-400 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base bg-[#444] px-2 py-1 rounded">
                            {profile.uid}
                          </span>
                        </h2>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-2 md:mt-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openChoresModal(profile);
                        }}
                        className="flex items-center bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Manage Chores
                      </button>

                      <div className="flex items-center bg-[rgba(76,175,80,0.2)] px-3 py-1 rounded border border-green-900">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 mr-1 text-green-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M13.5 3a1.5 1.5 0 0 1 3 0v1.5a1.5 1.5 0 0 1-3 0V3zM3.5 3a1.5 1.5 0 0 1 3.001 0v1.5a1.5 1.5 0 0 1-3.001 0V3zM3.5 10.5a1.5 1.5 0 0 1 3.001 0v1.5a1.5 1.5 0 0 1-3.001 0v-1.5zM10.5 3a1.5 1.5 0 0 1 3 0v1.5a1.5 1.5 0 0 1-3 0V3zM13.5 10.5a1.5 1.5 0 0 1 3 0v1.5a1.5 1.5 0 0 1-3 0v-1.5zM10.5 10.5a1.5 1.5 0 0 1 3 0v4.5a1.5 1.5 0 0 1-3 0v-4.5zM3.5 17.5a1.5 1.5 0 0 1 3.001 0v1.5a1.5 1.5 0 0 1-3.001 0v-1.5zM10.5 17.5a1.5 1.5 0 0 1 3 0v1.5a1.5 1.5 0 0 1-3 0v-1.5z" />
                          <path d="M17.5 10.5a1.5 1.5 0 0 1 3 0v4.5a1.5 1.5 0 0 1-3 0v-4.5z" />
                        </svg>
                        <span className="text-green-400 font-bold">
                          Level {playerStats.level}
                        </span>
                      </div>

                      <div className="flex items-center bg-[rgba(33,150,243,0.2)] px-3 py-1 rounded border border-blue-900">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 mr-1 text-blue-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12 7a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V8.414l-4.293 4.293a1 1 0 0 1-1.414 0L8 10.414l-4.293 4.293a1 1 0 0 1-1.414-1.414l5-5a1 1 0 0 1 1.414 0L11 10.586l3.293-3.293A1 1 0 0 1 12 7z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-blue-400 font-bold">
                          {playerStats.xp}/{playerStats.xpToNextLevel} XP
                        </span>
                      </div>

                      <div className="flex items-center bg-[rgba(156,39,176,0.2)] px-3 py-1 rounded border border-purple-900">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 mr-1 text-purple-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path
                            fillRule="evenodd"
                            d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-purple-400 font-bold">
                          {aggregateStats.totalSessions} Sessions
                        </span>
                      </div>

                      <div className="flex items-center bg-[rgba(255,152,0,0.2)] px-3 py-1 rounded border border-yellow-900">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 mr-1 text-yellow-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-yellow-400 font-bold">
                          {aggregateStats.formattedPlayTime} Play Time
                        </span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 border-t border-gray-700 pt-4">
                      {/* Profile Summary Stats */}
                      <div className="mb-4 bg-[#2a2a2a] p-3 rounded-md border border-gray-700">
                        <h3 className="text-sm font-semibold mb-2 text-gray-300">
                          User Statistics:
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-[#333] p-2 rounded border border-gray-600">
                            <p className="text-xs text-gray-400">
                              Chore Completion
                            </p>
                            <p className="text-lg font-bold text-green-400">
                              {aggregateStats.choreCompletionRate}%
                            </p>
                            <p className="text-xs text-gray-500">
                              {aggregateStats.completedChores}/
                              {aggregateStats.totalChores} chores
                            </p>
                          </div>

                          <div className="bg-[#333] p-2 rounded border border-gray-600">
                            <p className="text-xs text-gray-400">
                              Total Play Time
                            </p>
                            <p className="text-lg font-bold text-yellow-400">
                              {aggregateStats.formattedPlayTime}
                            </p>
                            <p className="text-xs text-gray-500">
                              {aggregateStats.totalPlayMinutes} minutes
                            </p>
                          </div>

                          <div className="bg-[#333] p-2 rounded border border-gray-600">
                            <p className="text-xs text-gray-400">
                              Play Sessions
                            </p>
                            <p className="text-lg font-bold text-purple-400">
                              {aggregateStats.totalSessions}
                            </p>
                            <p className="text-xs text-gray-500">all time</p>
                          </div>

                          <div className="bg-[#333] p-2 rounded border border-gray-600">
                            <p className="text-xs text-gray-400">Rewards</p>
                            <p className="text-lg font-bold text-blue-400">
                              {profile.rewards?.available || 0}
                            </p>
                            <p className="text-xs text-gray-500">available</p>
                          </div>
                        </div>
                      </div>

                      {/* Rewards Summary Section */}
                      {profile.rewards?.permanent &&
                        Object.keys(profile.rewards.permanent).length > 0 && (
                          <div className="mb-4 bg-[#2a2a2a] p-3 rounded-md border border-gray-700">
                            <h3 className="text-sm font-semibold mb-2 text-gray-300">
                              Active Rewards:
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(profile.rewards.permanent).map(
                                ([reward, value]) => (
                                  <div
                                    key={reward}
                                    className="bg-[#333] px-2 py-1 rounded border border-gray-600 text-sm"
                                  >
                                    <span className="capitalize text-gray-300">
                                      {reward.replace(/_/g, " ").toLowerCase()}:
                                    </span>
                                    <span className="text-green-400 ml-1 font-medium">
                                      {value}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                      {/* History Section - Full Width */}
                      <div className="bg-[#222] rounded-md p-4 shadow-md border border-gray-700">
                        <h3 className="text-lg font-semibold mb-3 text-green-400 flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 mr-2"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Activity History
                        </h3>
                        {profile.history &&
                        Object.keys(profile.history).length > 0 ? (
                          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {Object.entries(profile.history)
                              .sort(
                                ([dateA], [dateB]) =>
                                  new Date(dateB).getTime() -
                                  new Date(dateA).getTime()
                              )
                              .map(([date, dayData]) => {
                                const playStats = calculatePlayStats(dayData);
                                const choreStats =
                                  calculateDayChoreStats(dayData);
                                const dayKey = `${profile.uid}-${date}`;
                                const isDayExpanded =
                                  expandedDays[dayKey] || false;

                                return (
                                  <div
                                    key={date}
                                    className="bg-[#3a3a3a] rounded-md border border-gray-700"
                                  >
                                    <div
                                      className="p-3 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer"
                                      onClick={() =>
                                        toggleDayExpansion(profile.uid, date)
                                      }
                                    >
                                      <div className="flex items-center">
                                        <div
                                          className={`text-green-400 mr-2 transform transition-transform ${
                                            isDayExpanded ? "rotate-90" : ""
                                          }`}
                                        >
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-4 w-4"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                        </div>
                                        <h4 className="font-medium text-gray-200 text-lg">
                                          {date}
                                        </h4>
                                      </div>

                                      <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                                        <div className="bg-[rgba(33,150,243,0.2)] text-blue-400 px-2 py-1 rounded text-sm font-medium border border-blue-900">
                                          XP: {dayData.xp?.final || 0}
                                        </div>
                                        {playStats.totalSessions > 0 && (
                                          <div className="bg-[rgba(76,175,80,0.2)] text-green-400 px-2 py-1 rounded text-sm font-medium border border-green-900">
                                            Play: {playStats.formattedPlayTime}
                                          </div>
                                        )}
                                        <div className="bg-[rgba(156,39,176,0.2)] text-purple-400 px-2 py-1 rounded text-sm font-medium border border-purple-900">
                                          Sessions: {playStats.totalSessions}
                                        </div>
                                        {choreStats.total > 0 && (
                                          <div className="bg-[rgba(255,152,0,0.2)] text-yellow-400 px-2 py-1 rounded text-sm font-medium border border-yellow-900">
                                            Chores: {choreStats.completed}/
                                            {choreStats.total}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {isDayExpanded && (
                                      <div className="p-3 pt-0 border-t border-gray-600 mt-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                          <div>
                                            <h5 className="font-medium mb-2 text-gray-300">
                                              Chores:
                                            </h5>
                                            {dayData.chores &&
                                            dayData.chores.length > 0 ? (
                                              <ul className="space-y-1">
                                                {dayData.chores.map((chore) => {
                                                  const { icon, color } =
                                                    getStatusIcon(chore.status);
                                                  return (
                                                    <li
                                                      key={chore.id}
                                                      className="flex items-center justify-between bg-[#333] p-2 rounded border border-gray-700"
                                                    >
                                                      <span className="text-gray-200">
                                                        {chore.text}
                                                      </span>
                                                      <div
                                                        className={`${
                                                          chore.status ===
                                                          "completed"
                                                            ? "bg-[rgba(76,175,80,0.2)] border-green-900"
                                                            : chore.status ===
                                                              "na"
                                                            ? "bg-[rgba(158,158,158,0.2)] border-gray-600"
                                                            : "bg-[rgba(244,67,54,0.2)] border-red-900"
                                                        } 
                                                                    px-2 py-1 rounded border font-bold ${color}`}
                                                      >
                                                        {icon}
                                                      </div>
                                                    </li>
                                                  );
                                                })}
                                              </ul>
                                            ) : (
                                              <p className="text-gray-500 italic">
                                                No chores
                                              </p>
                                            )}
                                          </div>

                                          <div>
                                            <h5 className="font-medium mb-2 text-gray-300">
                                              Play Activity:
                                            </h5>
                                            {dayData.playTime?.sessions &&
                                            dayData.playTime.sessions.length >
                                              0 ? (
                                              <div className="space-y-2">
                                                <div className="bg-[#333] p-3 rounded border border-gray-700">
                                                  <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                      <p className="text-sm text-gray-400">
                                                        Total Sessions
                                                      </p>
                                                      <p className="text-lg font-bold text-purple-400">
                                                        {
                                                          playStats.totalSessions
                                                        }
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-sm text-gray-400">
                                                        Play Time
                                                      </p>
                                                      <p className="text-lg font-bold text-green-400">
                                                        {
                                                          playStats.formattedPlayTime
                                                        }
                                                      </p>
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="bg-[#333] p-2 rounded border border-gray-700">
                                                  <p className="text-sm text-gray-400 mb-1">
                                                    Session Timeline:
                                                  </p>
                                                  <ul className="space-y-1">
                                                    {dayData.playTime.sessions.map(
                                                      (session, index) => {
                                                        if (
                                                          session.start &&
                                                          session.end
                                                        ) {
                                                          const startTime =
                                                            new Date(
                                                              session.start
                                                            );
                                                          const endTime =
                                                            new Date(
                                                              session.end
                                                            );
                                                          const durationMs =
                                                            endTime.getTime() -
                                                            startTime.getTime();
                                                          const durationMinutes =
                                                            Math.round(
                                                              durationMs /
                                                                (1000 * 60)
                                                            );

                                                          return (
                                                            <li
                                                              key={index}
                                                              className="text-xs bg-[#444] p-1 rounded"
                                                            >
                                                              <span className="text-blue-400">
                                                                {startTime.toLocaleTimeString(
                                                                  [],
                                                                  {
                                                                    hour: "2-digit",
                                                                    minute:
                                                                      "2-digit",
                                                                  }
                                                                )}
                                                              </span>
                                                              <span className="text-gray-500 mx-1">
                                                                →
                                                              </span>
                                                              <span className="text-blue-400">
                                                                {endTime.toLocaleTimeString(
                                                                  [],
                                                                  {
                                                                    hour: "2-digit",
                                                                    minute:
                                                                      "2-digit",
                                                                  }
                                                                )}
                                                              </span>
                                                              <span className="text-green-400 ml-2">
                                                                (
                                                                {
                                                                  durationMinutes
                                                                }{" "}
                                                                min)
                                                              </span>
                                                            </li>
                                                          );
                                                        }
                                                        return null;
                                                      }
                                                    )}
                                                  </ul>
                                                </div>
                                              </div>
                                            ) : (
                                              <p className="text-gray-500 italic">
                                                No play activity recorded
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">
                            No history available
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chores Management Modal */}
      {isChoresModalOpen && (
        <div className="fixed inset-0 bg-[#111]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-hidden transition-all duration-200 ease-in-out">
          <div className="bg-gradient-to-br from-[#2a2a2a] to-[#333] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-700/50 animate-fadeIn">
            <div className="p-5 border-b border-gray-700/50 flex justify-between items-center bg-[#222]/50">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-2 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                    clipRule="evenodd"
                  />
                </svg>
                Manage Chores
              </h2>
              <button
                onClick={closeChoresModal}
                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/50 transition-all duration-200"
                aria-label="Close modal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className="mb-6">
                <h3 className="text-base font-medium text-gray-300 mb-3 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2 text-blue-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Add New Chore
                </h3>
                <div className="flex flex-col shadow-lg rounded-xl overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    <input
                      type="text"
                      value={newChoreText}
                      onChange={(e) => setNewChoreText(e.target.value)}
                      placeholder="Enter new chore description..."
                      className="w-full md:w-2/3 px-4 py-3 bg-[#333] border-b md:border-b-0 md:border-r border-gray-600 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent text-white placeholder-gray-400 text-base"
                      onKeyPress={(e) => e.key === "Enter" && handleAddChore()}
                    />

                    <button
                      onClick={handleAddChore}
                      className="w-full md:w-1/3 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-medium transition-all duration-200 flex items-center justify-center"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Add Chore
                    </button>
                  </div>

                  {/* Days of week selector for new chores */}
                  <div className="bg-[#2a2a2a] px-4 py-3 border-t border-gray-600/50">
                    <p className="text-sm text-gray-300 mb-2 flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1 text-yellow-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Schedule on specific days:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                        <button
                          key={day}
                          onClick={() => toggleDaySelection(day)}
                          className={`px-3 py-1.5 text-sm rounded-md transition-all duration-200 font-medium ${
                            selectedDaysOfWeek.includes(day)
                              ? "bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md"
                              : "bg-[#444] text-gray-300 hover:bg-[#555]"
                          }`}
                          aria-pressed={selectedDaysOfWeek.includes(day)}
                        >
                          {getDayName(day)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={resetDaysOfWeek}
                        className="text-xs text-gray-400 hover:text-blue-400 transition-colors flex items-center"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 mr-1"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Reset to all days
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-base font-medium text-gray-300 mb-3 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2 text-purple-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path
                      fillRule="evenodd"
                      d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Chores List
                  <span className="ml-2 bg-gray-700 text-gray-300 text-xs font-medium px-2 py-0.5 rounded-full">
                    {userChores.length}
                  </span>
                </h3>

                {/* Display a warning about chores that won't appear today */}
                {(() => {
                  const { dateString, dayOfWeek } = getTodayInfo();
                  const choresTodayFiltered = userChores.filter((chore) =>
                    shouldChoreAppearOnDay(chore, dateString)
                  );

                  const missingChores =
                    userChores.length - choresTodayFiltered.length;

                  if (missingChores > 0) {
                    return (
                      <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/20 border border-yellow-700/50 rounded-lg p-3 mb-4 text-sm shadow-md">
                        <div className="flex items-start">
                          <div className="bg-yellow-500/20 p-1.5 rounded-full mr-3">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 text-yellow-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-yellow-300 font-medium mb-1">
                              Some chores won&apos;t show today
                            </p>
                            <p className="text-gray-300">
                              Today is{" "}
                              <span className="font-medium text-white">
                                {getDayName(dayOfWeek)}
                              </span>
                              . {missingChores} out of {userChores.length}{" "}
                              {userChores.length === 1 ? "chore" : "chores"}{" "}
                              won&apos;t appear today based on scheduling.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar chores-list">
                {userChores.length === 0 ? (
                  <div className="text-center py-10 bg-[#2a2a2a]/50 rounded-lg border border-dashed border-gray-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 mx-auto text-gray-500 mb-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <p className="text-gray-400 text-center italic">
                      No chores added yet
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      Add your first chore using the form above
                    </p>
                  </div>
                ) : (
                  userChores.map((chore) => (
                    <div
                      key={chore.id}
                      className={`bg-gradient-to-r ${
                        !shouldChoreAppearOnDay(
                          chore,
                          getTodayInfo().dateString
                        )
                          ? "from-[#333]/90 to-[#383838]/90 border-gray-700/30"
                          : "from-[#3a3a3a] to-[#444] border-gray-600/70"
                      } rounded-lg border shadow-md transition-all hover:shadow-lg p-0.5`}
                    >
                      <div
                        className={`rounded-md p-4 ${
                          !shouldChoreAppearOnDay(
                            chore,
                            getTodayInfo().dateString
                          )
                            ? "opacity-70"
                            : ""
                        }`}
                      >
                        {editingChoreId === chore.id ? (
                          <div className="flex flex-col space-y-3">
                            <div className="flex flex-1">
                              <input
                                type="text"
                                value={editingChoreText}
                                onChange={(e) =>
                                  setEditingChoreText(e.target.value)
                                }
                                className="flex-1 px-3 py-2 bg-[#222] border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent text-white"
                                onKeyPress={(e) =>
                                  e.key === "Enter" && saveChoreEdit()
                                }
                                autoFocus
                              />
                            </div>

                            {/* Days of week selector for editing */}
                            <div className="bg-[#333] p-3 rounded-md border border-gray-700/50">
                              <p className="text-xs text-gray-300 mb-2 flex items-center">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3 mr-1 text-yellow-400"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Schedule on:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                                  <button
                                    key={day}
                                    onClick={() => toggleEditDaySelection(day)}
                                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                      editingDaysOfWeek.includes(day)
                                        ? "bg-blue-700 text-white shadow-sm"
                                        : "bg-[#444] text-gray-300 hover:bg-[#555]"
                                    }`}
                                    aria-pressed={editingDaysOfWeek.includes(
                                      day
                                    )}
                                  >
                                    {getDayName(day)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingChoreId(null);
                                  setEditingChoreText("");
                                }}
                                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded-md text-gray-200 transition-colors text-sm flex items-center"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4 mr-1"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Cancel
                              </button>
                              <button
                                onClick={saveChoreEdit}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors text-sm flex items-center"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4 mr-1"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-white text-lg font-medium">
                                {chore.text}
                              </span>
                              <div className="flex">
                                {!shouldChoreAppearOnDay(
                                  chore,
                                  getTodayInfo().dateString
                                ) && (
                                  <span className="mr-2 px-2 py-1 bg-yellow-700/30 text-yellow-300 text-xs rounded-md border border-yellow-700/50 flex items-center">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-3 w-3 mr-1"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1H6v8l4-2 4 2V6z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    Not today
                                  </span>
                                )}
                                <button
                                  onClick={() => startEditChore(chore)}
                                  className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-md transition-all"
                                  title="Edit chore"
                                  aria-label="Edit chore"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => deleteChore(chore.id)}
                                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-all ml-1"
                                  title="Delete chore"
                                  aria-label="Delete chore"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Display days of week as pills */}
                            <div className="flex flex-wrap gap-1.5">
                              {(chore.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).map(
                                (day) => (
                                  <span
                                    key={day}
                                    className={`text-xs px-2 py-1 rounded-md ${
                                      day === getTodayInfo().dayOfWeek
                                        ? "bg-gradient-to-r from-green-700 to-green-800 text-white"
                                        : "bg-[#333] text-gray-400 border border-gray-700/30"
                                    }`}
                                  >
                                    {getDayName(day)}
                                  </span>
                                )
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-5 border-t border-gray-700/50 flex justify-between items-center bg-[#222]/70">
              <div className="text-sm text-gray-400">
                <span className="text-blue-400 font-medium">
                  {userChores.length}
                </span>{" "}
                {userChores.length === 1 ? "chore" : "chores"} configured
              </div>
              <div className="flex gap-3">
                <button
                  onClick={closeChoresModal}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white transition-all flex items-center shadow-sm"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Cancel
                </button>
                <button
                  onClick={saveChores}
                  disabled={isSaving}
                  className={`px-4 py-2 rounded-md text-white transition-all flex items-center shadow-md ${
                    isSaving
                      ? "bg-blue-700/70 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:from-blue-700 active:to-blue-800"
                  }`}
                >
                  {isSaving ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(51, 51, 51, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(85, 85, 85, 0.7);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(102, 102, 102, 0.8);
        }
        .chores-list {
          scrollbar-width: thin;
          scrollbar-color: rgba(85, 85, 85, 0.7) rgba(51, 51, 51, 0.5);
        }
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: scale(0.98);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
    </Layout>
  );
};

export default ProfilesPage;
