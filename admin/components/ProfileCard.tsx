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
    <div
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
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 border-t border-gray-700 pt-4">
          <ProfileSummary profile={profile} />
          <ProfileHistory
            profile={profile}
            expandedDays={expandedDays}
            toggleDayExpansion={toggleDayExpansion}
          />
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
