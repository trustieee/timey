import React from "react";
import { AdminUserProfile } from "../types";
import { calculatePlayerStats } from "../utils/profileUtils";
import ProfileSummary from "./ProfileSummary";
import ProfileHistory from "./ProfileHistory";

interface ProfileCardProps {
  profile: AdminUserProfile;
  isExpanded: boolean;
  expandedDays: Record<string, boolean>;
  toggleProfileExpansion: (uid: string) => void;
  toggleDayExpansion: (uid: string, date: string) => void;
  openChoresModal: (profile: AdminUserProfile) => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  isExpanded,
  expandedDays,
  toggleProfileExpansion,
  toggleDayExpansion,
  openChoresModal,
}) => {
  const playerStats = calculatePlayerStats(profile);

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg shadow-xl overflow-hidden border border-slate-700">
      <div
        className={`p-4 transition-colors duration-200 ${
          isExpanded ? "bg-opacity-80" : "hover:bg-slate-800"
        } cursor-pointer`}
        onClick={() => toggleProfileExpansion(profile.uid)}
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
                  isExpanded ? "rotate-90" : ""
                }`}
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
            <div className="flex flex-col">
              <h3 className="font-semibold text-white text-lg tracking-tight">
                Player {profile.uid}
              </h3>
              <p className="text-slate-400 text-xs">
                Last updated:{" "}
                {new Date(profile.lastUpdated || "").toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openChoresModal(profile);
              }}
              className="flex items-center bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-full text-white transition-colors shadow-md text-sm font-medium min-w-[160px] max-w-[160px] justify-center"
            >
              <svg
                className="w-4 h-4 mr-1 opacity-80"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M11 4H4C3.44772 4 3 4.44772 3 5V20C3 20.5523 3.44772 21 4 21H19C19.5523 21 20 20.5523 20 20V13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 15L20 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M15 4H20V9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Manage Chores
            </button>

            <div className="flex items-center bg-emerald-900/30 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-inner text-emerald-300 font-medium hover:bg-emerald-900/40 transition-colors min-w-[160px] max-w-[160px] justify-center">
              <svg
                className="w-4 h-4 mr-1 opacity-80"
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
                  d="M15.9394 8.06055L8.06055 15.9394"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M16 16L8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>Level {playerStats.level}</span>
            </div>

            <div className="flex items-center bg-indigo-900/30 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-inner text-indigo-300 font-medium hover:bg-indigo-900/40 transition-colors min-w-[175px] max-w-[175px] justify-center">
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
              <span>
                {playerStats.xp}/{playerStats.xpToNextLevel} XP
              </span>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="overflow-hidden">
          <div className="p-4 pt-0">
            <div className="mt-3 space-y-4">
              <ProfileSummary profile={profile} />
              <ProfileHistory
                profile={profile}
                expandedDays={expandedDays}
                toggleDayExpansion={toggleDayExpansion}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
