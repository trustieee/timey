import React, { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { ChoreStatus } from "../../src/playerProfile";
import { AdminUserProfile, ChoreItem } from "../types";
import { getTodayInfo, getDayName } from "../utils/profileUtils";

interface ChoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProfile: AdminUserProfile | null;
  profiles: AdminUserProfile[];
  setProfiles: React.Dispatch<React.SetStateAction<AdminUserProfile[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const ChoresModal: React.FC<ChoresModalProps> = ({
  isOpen,
  onClose,
  selectedProfile,
  profiles,
  setProfiles,
  setError,
}) => {
  const [userChores, setUserChores] = useState<ChoreItem[]>([]);
  const [newChoreText, setNewChoreText] = useState("");
  const [editingChoreId, setEditingChoreId] = useState<number | null>(null);
  const [editingChoreText, setEditingChoreText] = useState("");
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([
    0, 1, 2, 3, 4, 5, 6,
  ]); // Default to all days
  const [editingDaysOfWeek, setEditingDaysOfWeek] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
    onClose();
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

  // Save chores to Firestore
  const saveChores = async () => {
    if (!selectedProfile) return;

    setIsSaving(true);
    try {
      // Use our reliable date function instead of relying on Date().toISOString()
      const { dateString: currentDate } = getTodayInfo();

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(currentDate)) {
        console.error("Invalid date format:", currentDate);
        throw new Error(
          `Invalid date format: ${currentDate}, expected YYYY-MM-DD`
        );
      }

      const profileRef = doc(db, "playerProfiles", selectedProfile.uid);

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
          if (profile.uid === selectedProfile.uid) {
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

  // Initialize chores from the selected profile
  React.useEffect(() => {
    if (isOpen && selectedProfile) {
      // ALWAYS use base chores from the profile first, not today's history
      // This ensures we see ALL chores including those scheduled for other days
      if (selectedProfile.chores && selectedProfile.chores.length > 0) {
        // Initialize with profile's base chores and set default status
        const choresWithStatus = selectedProfile.chores.map((chore) => {
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
    }
  }, [isOpen, selectedProfile]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#111]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-hidden transition-all duration-200 ease-in-out">
      <div className="bg-gradient-to-br from-[#2a2a2a] to-[#333] rounded-xl shadow-2xl w-full max-w-5xl h-[75vh] max-h-[95vh] flex flex-col overflow-hidden border border-gray-700/50 animate-fadeIn">
        <div className="p-4 border-b border-gray-700/50 flex justify-between items-center bg-[#222]/50">
          <h2 className="text-xl font-bold text-white flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-green-400"
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
              className="h-5 w-5"
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

        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column - Add New Chore */}
          <div className="bg-[#333] rounded-lg p-4 shadow-md flex flex-col">
            <h3 className="text-base font-medium text-gray-300 mb-3">
              Add New Chore
            </h3>

            {/* Chore input with integrated day selection */}
            <div className="mb-4 bg-[#444] rounded-md border border-gray-600 focus-within:ring-2 focus-within:ring-blue-500/40">
              <textarea
                id="choreText"
                value={newChoreText}
                onChange={(e) => setNewChoreText(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full px-3 py-2 bg-transparent border-0 focus:outline-none text-white resize-none min-h-[40px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddChore();
                  }
                }}
                rows={2}
              />

              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-600">
                <div className="flex items-center space-x-1">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleDaySelection(day)}
                      className={`w-7 h-7 flex items-center justify-center rounded-full text-xs transition-colors relative ${
                        selectedDaysOfWeek.includes(day)
                          ? "bg-blue-600 text-white"
                          : "bg-[#333] text-gray-400 hover:bg-[#555]"
                      }`}
                      title={`Toggle ${getDayName(day)}`}
                    >
                      {day === 4 ? "Th" : getDayName(day).charAt(0)}
                      {day === getTodayInfo().dayOfWeek && (
                        <span className="absolute -bottom-1 w-4 h-0.5 bg-green-400 rounded-full"></span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleAddChore}
                    disabled={!newChoreText.trim()}
                    className={`px-3 py-1 rounded-md text-white text-sm transition-colors ${
                      newChoreText.trim()
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-gray-600 cursor-not-allowed"
                    }`}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Quick tips section to fill some space */}
            <div className="mt-auto">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Tips:</h4>
              <ul className="text-xs text-gray-500 space-y-1 list-disc pl-4">
                <li>
                  Create chores for regular tasks that need to be completed
                </li>
                <li>Schedule chores on specific days of the week</li>
                <li>Completed chores will earn XP rewards</li>
              </ul>
            </div>
          </div>

          {/* Right Column - Chores List */}
          <div className="bg-[#333] rounded-lg p-4 shadow-md flex flex-col">
            <h3 className="text-base font-medium text-gray-300 mb-3 flex items-center">
              Chores List
              <span className="ml-2 bg-gray-600 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                {userChores.length}
              </span>
            </h3>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {userChores.length === 0 ? (
                <div className="text-center py-5 bg-[#3a3a3a] rounded-lg border border-dashed border-gray-600">
                  <p className="text-gray-400 italic">No chores added yet</p>
                </div>
              ) : (
                userChores.map((chore) => (
                  <div
                    key={chore.id}
                    className="bg-[#444] rounded-lg p-3 shadow-sm"
                  >
                    {editingChoreId === chore.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingChoreText}
                          onChange={(e) => setEditingChoreText(e.target.value)}
                          className="w-full px-3 py-2 bg-[#333] border border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-white resize-none"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveChoreEdit();
                            }
                          }}
                          rows={2}
                          autoFocus
                        />

                        <div className="flex flex-wrap gap-1 mb-2">
                          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                            <button
                              key={day}
                              onClick={() => toggleEditDaySelection(day)}
                              className={`w-7 h-7 flex items-center justify-center rounded-full text-xs transition-colors relative ${
                                editingDaysOfWeek.includes(day)
                                  ? "bg-blue-600 text-white"
                                  : "bg-[#333] text-gray-400 hover:bg-[#555]"
                              }`}
                            >
                              {day === 4 ? "Th" : getDayName(day).charAt(0)}
                              {day === getTodayInfo().dayOfWeek && (
                                <span className="absolute -bottom-1 w-4 h-0.5 bg-green-400 rounded-full"></span>
                              )}
                            </button>
                          ))}
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingChoreId(null);
                              setEditingChoreText("");
                            }}
                            className="px-2 py-1 bg-gray-600 rounded-md text-white text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveChoreEdit}
                            className="px-2 py-1 bg-blue-600 rounded-md text-white text-sm"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start">
                        <div className="flex-1 mr-2">
                          <p className="text-white font-medium break-words">
                            {chore.text}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                              const isEnabled = (
                                chore.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]
                              ).includes(day);
                              const isToday = day === getTodayInfo().dayOfWeek;
                              return (
                                <span
                                  key={day}
                                  className={`w-7 h-7 flex items-center justify-center rounded-full text-xs transition-colors relative ${
                                    isEnabled
                                      ? "bg-blue-600 text-white"
                                      : "bg-[#333] text-gray-400"
                                  }`}
                                >
                                  {day === 4 ? "Th" : getDayName(day).charAt(0)}
                                  {isToday && (
                                    <span className="absolute -bottom-1 w-4 h-0.5 bg-green-400 rounded-full"></span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex">
                          <button
                            onClick={() => startEditChore(chore)}
                            className="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-md transition-all"
                            title="Edit chore"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
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
                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-all ml-1"
                            title="Delete chore"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
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
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700/50 flex justify-end items-center bg-[#222]/70">
          <div className="flex gap-3">
            <button
              onClick={closeChoresModal}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-white"
            >
              Cancel
            </button>
            <button
              onClick={saveChores}
              disabled={isSaving}
              className={`px-3 py-1.5 rounded-md text-white ${
                isSaving
                  ? "bg-blue-700/70 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default ChoresModal;
