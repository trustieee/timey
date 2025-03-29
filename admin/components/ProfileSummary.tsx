import React from "react";
import { AdminUserProfile } from "../types";
import { calculateAggregateStats } from "../utils/profileUtils";

interface ProfileSummaryProps {
  profile: AdminUserProfile;
}

const ProfileSummary: React.FC<ProfileSummaryProps> = ({ profile }) => {
  const aggregateStats = calculateAggregateStats(profile);

  return (
    <>
      {/* Profile Summary Stats */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <div className="flex items-center mb-4">
          <svg
            className="w-5 h-5 text-violet-400 mr-2"
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
          <h3 className="text-white font-semibold">User Statistics</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-emerald-900/20 backdrop-blur-sm rounded-lg p-3 border border-emerald-900/50">
            <p className="text-xs text-emerald-300 mb-1">Chore Completion</p>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-white">
                {aggregateStats.choreCompletionRate}
              </span>
              <span className="text-emerald-400 text-xs ml-1">%</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {aggregateStats.completedChores}/{aggregateStats.totalChores}{" "}
              chores
            </p>
          </div>

          <div className="bg-amber-900/20 backdrop-blur-sm rounded-lg p-3 border border-amber-900/50">
            <p className="text-xs text-amber-300 mb-1">Total Play Time</p>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-white">
                {aggregateStats.formattedPlayTime
                  .replace(/hrs?/i, "")
                  .replace(/mins?/i, "")}
              </span>
              <span className="text-amber-400 text-xs ml-1">
                {aggregateStats.formattedPlayTime.includes("hr")
                  ? "hours"
                  : "minutes"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {aggregateStats.totalPlayMinutes} total minutes
            </p>
          </div>

          <div className="bg-violet-900/20 backdrop-blur-sm rounded-lg p-3 border border-violet-900/50">
            <p className="text-xs text-violet-300 mb-1">Play Sessions</p>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-white">
                {aggregateStats.totalSessions}
              </span>
              <span className="text-violet-400 text-xs ml-1">sessions</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">all time</p>
          </div>

          <div className="bg-indigo-900/20 backdrop-blur-sm rounded-lg p-3 border border-indigo-900/50">
            <p className="text-xs text-indigo-300 mb-1">Rewards</p>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-white">
                {profile.rewards?.available || 0}
              </span>
              <span className="text-indigo-400 text-xs ml-1">available</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">pending redemption</p>
          </div>
        </div>
      </div>

      {/* Rewards Summary Section */}
      {profile.rewards?.permanent &&
        Object.keys(profile.rewards.permanent).length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center mb-4">
              <svg
                className="w-5 h-5 text-amber-400 mr-2"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 15C15.866 15 19 11.866 19 8C19 4.13401 15.866 1 12 1C8.13401 1 5 4.13401 5 8C5 11.866 8.13401 15 12 15Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 15V23"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M15 19H9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M15 7.22571L10.8 11.4257L8.5 9.12571"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h3 className="text-white font-semibold">Active Rewards</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(profile.rewards.permanent).map(
                ([reward, value]) => (
                  <div
                    key={reward}
                    className="bg-amber-900/20 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center border border-amber-900/50"
                  >
                    <svg
                      className="w-3.5 h-3.5 mr-1 text-amber-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 8L15 13.5L19 10L17.5 16H6.5L5 10L9 13.5L12 8Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="capitalize text-amber-100 text-sm">
                      {reward.replace(/_/g, " ").toLowerCase()}:
                    </span>
                    <span className="text-white ml-1 font-medium text-sm">
                      {value}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
    </>
  );
};

export default ProfileSummary;
