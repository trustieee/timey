import React from "react";
import { AdminUserProfile } from "../types";
import DayHistory from "./DayHistory";

interface ProfileHistoryProps {
  profile: AdminUserProfile;
  expandedDays: Record<string, boolean>;
  toggleDayExpansion: (uid: string, date: string) => void;
}

const ProfileHistory: React.FC<ProfileHistoryProps> = ({
  profile,
  expandedDays,
  toggleDayExpansion,
}) => {
  return (
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
      {profile.history && Object.keys(profile.history).length > 0 ? (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {Object.entries(profile.history)
            .sort(
              ([dateA], [dateB]) =>
                new Date(dateB).getTime() - new Date(dateA).getTime()
            )
            .map(([date, dayData]) => {
              const dayKey = `${profile.uid}-${date}`;
              const isDayExpanded = expandedDays[dayKey] || false;

              return (
                <DayHistory
                  key={date}
                  date={date}
                  dayData={dayData}
                  uid={profile.uid}
                  isDayExpanded={isDayExpanded}
                  toggleDayExpansion={toggleDayExpansion}
                />
              );
            })}
        </div>
      ) : (
        <p className="text-gray-500 italic">No history available</p>
      )}
    </div>
  );
};

export default ProfileHistory;
