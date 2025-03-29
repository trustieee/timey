import React from "react";
import { PlayerProfile, ChoreStatus } from "../../src/playerProfile";
import {
  calculatePlayStats,
  calculateDayChoreStats,
  getStatusIcon,
} from "../utils/profileUtils";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { APP_CONFIG } from "../utils/appConfig";

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

  // Function to cycle through chore statuses: incomplete -> completed -> na -> incomplete
  const cycleChoreStatus = async (e: React.MouseEvent, choreId: number) => {
    e.stopPropagation(); // Prevent day expansion toggle
    
    // Find the chore
    const chore = dayData.chores.find(c => c.id === choreId);
    if (!chore) return;
    
    // Define status cycle
    const nextStatus: { [key in ChoreStatus]: ChoreStatus } = {
      incomplete: "completed",
      completed: "na",
      na: "incomplete"
    };
    
    const newStatus = nextStatus[chore.status];
    
    try {
      // Get user profile document reference
      const profileRef = doc(db, "playerProfiles", uid);
      
      // Update the completedAt timestamp if completed
      let updatedChore: any = {
        ...chore,
        status: newStatus
      };
      
      if (newStatus === "completed") {
        // Add completedAt timestamp when marking as completed
        updatedChore.completedAt = new Date().toISOString();
      } else {
        // Delete the completedAt field when not completed (don't set to undefined)
        delete updatedChore.completedAt;
      }
      
      // Create updated history object with the new chore status
      const updatedChores = dayData.chores.map(c => 
        c.id === choreId ? updatedChore : c
      );
      
      // Create a copy of the day data with updated chores
      const updatedDayData = {
        ...dayData,
        chores: updatedChores
      };
      
      // Update XP based on chore status change
      const XP_FOR_CHORE = APP_CONFIG.PROFILE.XP_FOR_CHORE;
      
      if (chore.status === "completed" && newStatus !== "completed") {
        // Remove XP if changing from completed to another status
        updatedDayData.xp = {
          ...dayData.xp,
          gained: Math.max(0, (dayData.xp?.gained || 0) - XP_FOR_CHORE),
          final: Math.max(0, (dayData.xp?.final || 0) - XP_FOR_CHORE)
        };
      } else if (chore.status !== "completed" && newStatus === "completed") {
        // Add XP if completing a chore
        updatedDayData.xp = {
          ...dayData.xp,
          gained: (dayData.xp?.gained || 0) + XP_FOR_CHORE,
          final: (dayData.xp?.final || 0) + XP_FOR_CHORE
        };
      }
      
      // Update the history
      const updatedHistory = {
        [date]: updatedDayData
      };
      
      // Update the profile in Firestore
      await setDoc(profileRef, {
        history: updatedHistory,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      
    } catch (error) {
      console.error("Error updating chore status:", error);
    }
  };

  return (
    <div className="bg-[#3a3a3a] rounded-md border border-gray-700">
      <div
        className="p-3 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer"
        onClick={() => toggleDayExpansion(uid, date)}
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
          <h4 className="font-medium text-gray-200 text-lg">{date}</h4>
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
              Chores: {choreStats.completed}/{choreStats.total}
            </div>
          )}
        </div>
      </div>

      {isDayExpanded && (
        <div className="p-3 pt-0 border-t border-gray-600 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
              <h5 className="font-medium mb-2 text-gray-300">Chores:</h5>
              {dayData.chores && dayData.chores.length > 0 ? (
                <ul className="space-y-1">
                  {dayData.chores.map((chore) => {
                    const { icon, color } = getStatusIcon(chore.status);
                    return (
                      <li
                        key={chore.id}
                        className="flex items-center justify-between bg-[#333] p-2 rounded border border-gray-700"
                      >
                        <span className="text-gray-200 break-words mr-2">
                          {chore.text}
                        </span>
                        <div
                          className={`${
                            chore.status === "completed"
                              ? "bg-[rgba(76,175,80,0.2)] border-green-900"
                              : chore.status === "na"
                              ? "bg-[rgba(158,158,158,0.2)] border-gray-600"
                              : "bg-[rgba(244,67,54,0.2)] border-red-900"
                          } 
                                      px-2 py-1 rounded border font-bold ${color} cursor-pointer transition-opacity hover:opacity-80`}
                          onClick={(e) => cycleChoreStatus(e, chore.id)}
                          title="Click to change status"
                        >
                          {icon}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-gray-500 italic">No chores</p>
              )}
            </div>

            <div>
              <h5 className="font-medium mb-2 text-gray-300">Play Activity:</h5>
              {dayData.playTime?.sessions &&
              dayData.playTime.sessions.length > 0 ? (
                <div className="space-y-2">
                  <div className="bg-[#333] p-3 rounded border border-gray-700">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-sm text-gray-400">Total Sessions</p>
                        <p className="text-lg font-bold text-purple-400">
                          {playStats.totalSessions}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Play Time</p>
                        <p className="text-lg font-bold text-green-400">
                          {playStats.formattedPlayTime}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#333] p-2 rounded border border-gray-700">
                    <p className="text-sm text-gray-400 mb-1">
                      Session Timeline:
                    </p>
                    <ul className="space-y-1">
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
                              className="text-xs bg-[#444] p-1 rounded"
                            >
                              <span className="text-blue-400">
                                {startTime.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span className="text-gray-500 mx-1">→</span>
                              <span className="text-blue-400">
                                {endTime.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span className="text-green-400 ml-2">
                                ({durationMinutes} min)
                              </span>
                            </li>
                          );
                        }
                        return null;
                      })}
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
};

export default DayHistory;
