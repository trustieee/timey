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
      <div className="mb-4 bg-[#2a2a2a] p-3 rounded-md border border-gray-700">
        <h3 className="text-sm font-semibold mb-2 text-gray-300">
          User Statistics:
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#333] p-2 rounded border border-gray-600">
            <p className="text-xs text-gray-400">Chore Completion</p>
            <p className="text-lg font-bold text-green-400">
              {aggregateStats.choreCompletionRate}%
            </p>
            <p className="text-xs text-gray-500">
              {aggregateStats.completedChores}/{aggregateStats.totalChores}{" "}
              chores
            </p>
          </div>

          <div className="bg-[#333] p-2 rounded border border-gray-600">
            <p className="text-xs text-gray-400">Total Play Time</p>
            <p className="text-lg font-bold text-yellow-400">
              {aggregateStats.formattedPlayTime}
            </p>
            <p className="text-xs text-gray-500">
              {aggregateStats.totalPlayMinutes} minutes
            </p>
          </div>

          <div className="bg-[#333] p-2 rounded border border-gray-600">
            <p className="text-xs text-gray-400">Play Sessions</p>
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
    </>
  );
};

export default ProfileSummary;
