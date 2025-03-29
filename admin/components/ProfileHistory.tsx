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
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center mb-4">
        <svg
          className="w-5 h-5 text-indigo-400 mr-2"
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
          <path d="M3 9H21" stroke="currentColor" strokeWidth="2" />
        </svg>
        <h3 className="text-white font-semibold">Activity History</h3>
        {profile.history && Object.keys(profile.history).length > 0 && (
          <span className="ml-auto text-xs font-medium text-slate-400">
            {Object.keys(profile.history).length} days
          </span>
        )}
      </div>

      {profile.history && Object.keys(profile.history).length > 0 ? (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-slate-400 text-sm">
            No activity history available
          </p>
        </div>
      )}
    </div>
  );
};

export default ProfileHistory;
