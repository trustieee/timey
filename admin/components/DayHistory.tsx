import React, { useState } from "react";
import { PlayerProfile, ChoreStatus } from "../../src/playerProfile";
import {
  calculatePlayStats,
  calculateDayChoreStats,
} from "../utils/profileUtils";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { APP_CONFIG } from "../utils/appConfig";
import { MotionConfig } from "framer-motion";

interface DayHistoryProps {
  date: string;
  dayData: PlayerProfile["history"][string];
  uid: string;
  isDayExpanded: boolean;
  toggleDayExpansion: (uid: string, date: string) => void;
}

const DayHistory: React.FC<DayHistoryProps> = ({
  date,
  dayData,
  uid,
  isDayExpanded,
  toggleDayExpansion,
}) => {
  const playStats = calculatePlayStats(dayData);
  const choreStats = calculateDayChoreStats(dayData);
  const [isUpdating, setIsUpdating] = useState(false);

  // Format date to be more readable
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Function to cycle through chore statuses: incomplete -> completed -> na -> incomplete
  const cycleChoreStatus = async (e: React.MouseEvent, choreId: number) => {
    e.stopPropagation(); // Prevent day expansion toggle
    setIsUpdating(true);

    // Find the chore
    const chore = dayData.chores.find((c) => c.id === choreId);
    if (!chore) {
      setIsUpdating(false);
      return;
    }

    // Define status cycle
    const nextStatus: { [key in ChoreStatus]: ChoreStatus } = {
      incomplete: "completed",
      completed: "na",
      na: "incomplete",
    };

    const newStatus = nextStatus[chore.status];

    try {
      // Get user profile document reference
      const profileRef = doc(db, "playerProfiles", uid);

      // Update the completedAt timestamp if completed
      const updatedChore = {
        ...chore,
        status: newStatus,
      };

      if (newStatus === "completed") {
        // Add completedAt timestamp when marking as completed
        updatedChore.completedAt = new Date().toISOString();
      } else {
        // Delete the completedAt field when not completed (don't set to undefined)
        delete updatedChore.completedAt;
      }

      // Create updated history object with the new chore status
      const updatedChores = dayData.chores.map((c) =>
        c.id === choreId ? updatedChore : c
      );

      // Create a copy of the day data with updated chores
      const updatedDayData = {
        ...dayData,
        chores: updatedChores,
      };

      // Update XP based on chore status change
      const XP_FOR_CHORE = APP_CONFIG.PROFILE.XP_FOR_CHORE;

      if (chore.status === "completed" && newStatus !== "completed") {
        // Remove XP if changing from completed to another status
        updatedDayData.xp = {
          ...dayData.xp,
          gained: Math.max(0, (dayData.xp?.gained || 0) - XP_FOR_CHORE),
          final: Math.max(0, (dayData.xp?.final || 0) - XP_FOR_CHORE),
        };
      } else if (chore.status !== "completed" && newStatus === "completed") {
        // Add XP if completing a chore
        updatedDayData.xp = {
          ...dayData.xp,
          gained: (dayData.xp?.gained || 0) + XP_FOR_CHORE,
          final: (dayData.xp?.final || 0) + XP_FOR_CHORE,
        };
      }

      // Update the history
      const updatedHistory = {
        [date]: updatedDayData,
      };

      // Update the profile in Firestore
      await setDoc(
        profileRef,
        {
          history: updatedHistory,
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error updating chore status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Check if the date is the current day
  const isCurrentDay = () => {
    // Get today's date and format as YYYY-MM-DD
    const today = new Date();
    const todayFormatted = today.toISOString().split("T")[0];

    // Check if the date string is in ISO format (YYYY-MM-DD) or another format
    let dateToCompare = date;

    // If date is not in YYYY-MM-DD format, try to normalize it
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      try {
        // Parse the date string and convert to YYYY-MM-DD
        const parsedDate = new Date(date);
        dateToCompare = parsedDate.toISOString().split("T")[0];
      } catch (e) {
        console.error("Error parsing date:", e);
        return false;
      }
    }

    // Simple string comparison of dates in YYYY-MM-DD format
    return todayFormatted === dateToCompare;
  };

  // Log the current status for debugging
  const currentDay = isCurrentDay();
  console.log(`Date: ${date}, Is Current Day: ${currentDay}`);

  // Status display for chores
  const ChoreStatusIndicator = ({ status }: { status: ChoreStatus }) => {
    const currentDay = isCurrentDay();

    const statusConfig = {
      completed: {
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5 12L10 17L19 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
        label: "Completed",
        bgColor: "bg-emerald-600",
        textColor: "text-emerald-100",
        hoverColor: "hover:bg-emerald-500",
      },
      incomplete: {
        icon: currentDay ? (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="12"
              cy="12"
              r="8"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M12 7V12L15 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="12"
              cy="12"
              r="8"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M16 8L8 16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M8 8L16 16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ),
        label: currentDay ? "Pending" : "Incomplete",
        bgColor: currentDay ? "bg-amber-600" : "bg-red-600",
        textColor: currentDay ? "text-amber-100" : "text-red-100",
        hoverColor: currentDay ? "hover:bg-amber-500" : "hover:bg-red-500",
      },
      na: {
        icon: (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="12"
              cy="12"
              r="8"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M9 12H15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ),
        label: "N/A",
        bgColor: "bg-slate-600",
        textColor: "text-slate-100",
        hoverColor: "hover:bg-slate-500",
      },
    };

    const config = statusConfig[status];

    return (
      <div
        className={`${config.bgColor} ${config.textColor} px-3 py-1 rounded-full flex items-center gap-1 ${config.hoverColor} cursor-pointer transition-all shadow-md text-xs font-medium`}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </div>
    );
  };

  // Calculate progress percentage for visual indicator
  const progressPercentage =
    choreStats.total > 0
      ? Math.round((choreStats.completed / choreStats.total) * 100)
      : 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg shadow-xl overflow-hidden border border-slate-700">
        <div
          className={`p-4 transition-colors duration-200 ${
            isDayExpanded ? "bg-opacity-80" : "hover:bg-slate-800"
          } cursor-pointer`}
          onClick={() => toggleDayExpansion(uid, date)}
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 relative">
            <div className="flex items-center space-x-2">
              <div className="text-indigo-400 w-5 h-5 flex-shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transform transition-transform ${
                    isDayExpanded ? "rotate-90" : ""
                  }`}
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
              <div className="flex flex-col">
                <h3 className="font-semibold text-white text-lg tracking-tight">
                  {formatDate(date)}
                </h3>
                <p className="text-slate-400 text-xs">
                  {new Date(date).toLocaleDateString(undefined, {
                    weekday: "long",
                  })}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center bg-indigo-900/30 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-inner text-indigo-300 font-medium hover:bg-indigo-900/40 transition-colors">
                <svg
                  className="w-4 h-4 mr-1 opacity-80"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M13.5 3H12H8C6.34315 3 5 4.34315 5 6V18C5 19.6569 6.34315 21 8 21H16C17.6569 21 19 19.6569 19 18V9.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M17 7L13 3M17 7V3H13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 12H15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M9 16H13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <span>XP: {dayData.xp?.final || 0}</span>
              </div>

              {playStats.totalSessions > 0 && (
                <div className="flex items-center bg-emerald-900/30 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-inner text-emerald-300 font-medium hover:bg-emerald-900/40 transition-colors">
                  <svg
                    className="w-4 h-4 mr-1 opacity-80"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 8V12L15 15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>{playStats.formattedPlayTime}</span>
                </div>
              )}

              <div className="flex items-center bg-violet-900/30 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-inner text-violet-300 font-medium hover:bg-violet-900/40 transition-colors">
                <svg
                  className="w-4 h-4 mr-1 opacity-80"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M17 17L22 22"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4 10H8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4 18H10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 4V8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="8"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                <span>{playStats.totalSessions} sessions</span>
              </div>

              {choreStats.total > 0 && (
                <div className="flex items-center bg-amber-900/30 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-inner text-amber-300 font-medium relative hover:bg-amber-900/40 transition-colors">
                  <svg
                    className="w-4 h-4 mr-1 opacity-80"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M12 12L9 15M12 12L15 15M12 12V3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>
                    {choreStats.completed}/{choreStats.total} chores
                  </span>
                  <div className="absolute -bottom-1 left-0 right-0 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${progressPercentage}%` }}
                      className="h-full bg-amber-500 transition-all duration-500 ease-out"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {isDayExpanded && (
          <div className="overflow-hidden">
            <div className="p-4 pt-0">
              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Chores Section */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700 shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center mb-4">
                    <svg
                      className="w-5 h-5 text-amber-400 mr-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M9 6L20 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M3.5 6H6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M3.5 12H6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M3.5 18H6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="7.5"
                        cy="6"
                        r="1.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx="7.5"
                        cy="12"
                        r="1.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx="7.5"
                        cy="18"
                        r="1.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M9 12L20 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M9 18L20 18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <h3 className="text-white font-semibold">Daily Chores</h3>
                    {choreStats.total > 0 && (
                      <span className="ml-auto text-xs font-medium text-slate-400">
                        {choreStats.completed} of {choreStats.total} completed
                      </span>
                    )}
                  </div>

                  {dayData.chores && dayData.chores.length > 0 ? (
                    <ul className="space-y-2">
                      {dayData.chores.map((chore) => (
                        <li
                          key={chore.id}
                          className={`flex items-center justify-between p-3 rounded-lg bg-slate-700/50 backdrop-blur-sm border border-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-700/70 ${
                            isUpdating ? "opacity-70" : "opacity-100"
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div
                              onClick={(e) => cycleChoreStatus(e, chore.id)}
                              className="cursor-pointer pt-0.5"
                            >
                              {chore.status === "completed" ? (
                                <div className="w-5 h-5 rounded-full border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center text-white">
                                  <svg
                                    className="w-3 h-3"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M5 12L10 17L19 8"
                                      stroke="currentColor"
                                      strokeWidth="3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </div>
                              ) : chore.status === "na" ? (
                                <div className="w-5 h-5 rounded-full border-2 border-slate-500 bg-slate-500/30 flex items-center justify-center text-slate-300">
                                  <svg
                                    className="w-3 h-3"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <circle
                                      cx="12"
                                      cy="12"
                                      r="8"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                    />
                                    <path
                                      d="M9 12H15"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-amber-500/70 flex items-center justify-center bg-transparent">
                                  {!isCurrentDay() ? (
                                    <svg
                                      className="w-3 h-3 text-red-500"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M18 6L6 18"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <path
                                        d="M6 6L18 18"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  ) : (
                                    <svg
                                      className="w-3 h-3 text-amber-500"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <circle
                                        cx="12"
                                        cy="12"
                                        r="8"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      />
                                      <path
                                        d="M12 8V12L14 14"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                  )}
                                </div>
                              )}
                            </div>
                            <span
                              className={`font-medium break-words ${
                                chore.status === "completed"
                                  ? "text-slate-300 line-through"
                                  : chore.status === "na"
                                  ? "text-slate-500"
                                  : "text-white"
                              }`}
                            >
                              {chore.text}
                            </span>
                          </div>

                          <div
                            onClick={(e) => cycleChoreStatus(e, chore.id)}
                            className="cursor-pointer"
                          >
                            <ChoreStatusIndicator status={chore.status} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="w-16 h-16 mb-3 rounded-full bg-slate-700 flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-slate-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <p className="text-slate-400 text-sm">
                        No chores assigned for this day
                      </p>
                    </div>
                  )}
                </div>

                {/* Play Activity Section */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700 shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center mb-4">
                    <svg
                      className="w-5 h-5 text-emerald-400 mr-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 7V12L15 15"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <h3 className="text-white font-semibold">Play Activity</h3>
                    {playStats.totalSessions > 0 && (
                      <span className="ml-auto text-xs font-medium text-slate-400">
                        {playStats.totalSessions} session
                        {playStats.totalSessions !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {dayData.playTime?.sessions &&
                  dayData.playTime.sessions.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-indigo-900/20 backdrop-blur-sm rounded-lg p-3 border border-indigo-900/50">
                          <p className="text-xs text-indigo-300 mb-1">
                            Total Sessions
                          </p>
                          <div className="flex items-baseline">
                            <span className="text-2xl font-bold text-white">
                              {playStats.totalSessions}
                            </span>
                            <span className="text-indigo-400 text-xs ml-1">
                              sessions
                            </span>
                          </div>
                        </div>
                        <div className="bg-emerald-900/20 backdrop-blur-sm rounded-lg p-3 border border-emerald-900/50">
                          <p className="text-xs text-emerald-300 mb-1">
                            Play Time
                          </p>
                          <div className="flex items-baseline">
                            <span className="text-2xl font-bold text-white">
                              {playStats.formattedPlayTime
                                .replace(/hrs?/i, "")
                                .replace(/mins?/i, "")}
                            </span>
                            <span className="text-emerald-400 text-xs ml-1">
                              {playStats.formattedPlayTime.includes("hr")
                                ? "hours"
                                : "minutes"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center">
                          <svg
                            className="w-4 h-4 mr-1 text-slate-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <rect
                              x="3"
                              y="4"
                              width="18"
                              height="16"
                              rx="2"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                            <path
                              d="M8 2V4"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                            <path
                              d="M16 2V4"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                            <path
                              d="M3 9H21"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          </svg>
                          Session Timeline
                        </h4>
                        <ul className="space-y-2 max-h-40 overflow-auto pr-1 scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
                          {dayData.playTime.sessions.map((session, index) => {
                            if (session.start && session.end) {
                              const startTime = new Date(session.start);
                              const endTime = new Date(session.end);
                              const durationMs =
                                endTime.getTime() - startTime.getTime();
                              const durationMinutes = Math.round(
                                durationMs / (1000 * 60)
                              );

                              return (
                                <li
                                  key={index}
                                  className="bg-slate-700/50 p-2.5 rounded-lg border border-slate-600 flex flex-col sm:flex-row sm:items-center hover:bg-slate-700/70 transition-colors duration-200"
                                >
                                  <div className="flex items-center">
                                    <div className="h-8 w-8 rounded-full bg-indigo-900/50 flex items-center justify-center mr-2">
                                      <svg
                                        className="w-4 h-4 text-indigo-400"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <path
                                          d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                        />
                                        <path
                                          d="M12 7V12L15 15"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-sm text-white font-medium">
                                        Session {index + 1}
                                      </p>
                                      <p className="text-xs text-slate-400">
                                        {startTime.toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                        <span className="mx-1">→</span>
                                        {endTime.toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="ml-auto mt-2 sm:mt-0 bg-emerald-900/30 text-emerald-300 text-xs font-medium px-2 py-1 rounded-full">
                                    {durationMinutes} min
                                  </div>
                                </li>
                              );
                            }
                            return null;
                          })}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="w-16 h-16 mb-3 rounded-full bg-slate-700 flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-slate-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <p className="text-slate-400 text-sm">
                        No play activity recorded for this day
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
};

export default DayHistory;
