import React, { useState } from "react";
import type { NextPage } from "next";
import Head from "next/head";
import Layout from "../components/Layout";
import { PlayerProfile, ChoreStatus } from "../../src/playerProfile";
import { db, auth } from "../utils/firebase";
import { collection, getDocs } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";

// Interface for admin view (only adding what we need on top of PlayerProfile)
interface AdminUserProfile extends PlayerProfile {
  uid: string;
}

const ProfilesPage: NextPage = () => {
  const [profiles, setProfiles] = useState<AdminUserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

    // Calculate level (simplified version)
    // This should match the game's level calculation logic
    const xpPerLevel = [100, 200, 300, 400, 500]; // Example values
    let level = 1;
    let xp = totalXp;

    while (level <= xpPerLevel.length && xp >= xpPerLevel[level - 1]) {
      xp -= xpPerLevel[level - 1];
      level++;
    }

    const xpToNextLevel =
      level <= xpPerLevel.length ? xpPerLevel[level - 1] : 1000;

    return {
      level,
      xp,
      totalXp,
      xpToNextLevel,
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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsAuthenticated(true);
      fetchProfiles();
    } catch (error: FirebaseError | unknown) {
      console.error("Authentication error:", error);
      const errorMessage =
        error instanceof FirebaseError ? error.message : "Unknown error";
      setError(`Authentication failed: ${errorMessage}`);
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const profilesCollection = collection(db, "playerProfiles");
      const profilesSnapshot = await getDocs(profilesCollection);

      const profilesData: AdminUserProfile[] = [];

      profilesSnapshot.forEach((doc) => {
        const profileData = doc.data() as PlayerProfile;

        profilesData.push({
          uid: doc.id,
          ...profileData,
        });
      });

      setProfiles(profilesData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      setError("Failed to load user profiles");
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>User Profiles - Timey Admin</title>
        <meta name="description" content="Manage user profiles in Timey" />
      </Head>

      <div className="bg-[#222] shadow-lg rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-6 text-green-400 border-b border-gray-700 pb-2">
          User Profiles
        </h1>

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
          <div className="space-y-8">
            {profiles.map((profile) => {
              const playerStats = calculatePlayerStats(profile);

              return (
                <div
                  key={profile.uid}
                  className="border border-gray-700 rounded-lg p-6 shadow-md bg-[#333] hover:bg-[#3a3a3a] transition duration-150"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-gray-700 pb-3">
                    <div>
                      <h2 className="text-xl font-bold text-green-400 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base bg-[#444] px-2 py-1 rounded">
                          {profile.uid}
                        </span>
                      </h2>
                    </div>

                    <div className="flex items-center space-x-4 mt-2 md:mt-0">
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

                      {profile.rewards?.available > 0 && (
                        <div className="flex items-center bg-[rgba(156,39,176,0.2)] px-3 py-1 rounded border border-purple-900">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 mr-1 text-purple-400"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                          </svg>
                          <span className="text-purple-400 font-bold">
                            {profile.rewards.available} Rewards
                          </span>
                        </div>
                      )}
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
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(profile.history)
                          .sort(
                            ([dateA], [dateB]) =>
                              new Date(dateB).getTime() -
                              new Date(dateA).getTime()
                          )
                          .map(([date, dayData]) => {
                            const playStats = calculatePlayStats(dayData);

                            return (
                              <div
                                key={date}
                                className="bg-[#3a3a3a] p-3 rounded-md border border-gray-700"
                              >
                                <div className="flex flex-col md:flex-row justify-between md:items-center mb-3 pb-2 border-b border-gray-600">
                                  <h4 className="font-medium text-gray-200 text-lg">
                                    {date}
                                  </h4>
                                  <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                                    <div className="bg-[rgba(33,150,243,0.2)] text-blue-400 px-2 py-1 rounded text-sm font-medium border border-blue-900">
                                      XP: {dayData.xp?.final || 0}
                                    </div>
                                    {playStats.totalSessions > 0 && (
                                      <div className="bg-[rgba(76,175,80,0.2)] text-green-400 px-2 py-1 rounded text-sm font-medium border border-green-900">
                                        Play Time: {playStats.formattedPlayTime}
                                      </div>
                                    )}
                                    <div className="bg-[rgba(156,39,176,0.2)] text-purple-400 px-2 py-1 rounded text-sm font-medium border border-purple-900">
                                      Sessions: {playStats.totalSessions}
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h5 className="font-medium mb-2 text-gray-300">
                                      Chores:
                                    </h5>
                                    {dayData.chores &&
                                    dayData.chores.length > 0 ? (
                                      <ul className="space-y-1">
                                        {dayData.chores.map((chore) => {
                                          const { icon, color } = getStatusIcon(
                                            chore.status
                                          );
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
                                                  chore.status === "completed"
                                                    ? "bg-[rgba(76,175,80,0.2)] border-green-900"
                                                    : chore.status === "na"
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
                                    dayData.playTime.sessions.length > 0 ? (
                                      <div className="space-y-2">
                                        <div className="bg-[#333] p-3 rounded border border-gray-700">
                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <p className="text-sm text-gray-400">
                                                Total Sessions
                                              </p>
                                              <p className="text-lg font-bold text-purple-400">
                                                {playStats.totalSessions}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-sm text-gray-400">
                                                Play Time
                                              </p>
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
                                            {dayData.playTime.sessions.map(
                                              (session, index) => {
                                                if (
                                                  session.start &&
                                                  session.end
                                                ) {
                                                  const startTime = new Date(
                                                    session.start
                                                  );
                                                  const endTime = new Date(
                                                    session.end
                                                  );
                                                  const durationMs =
                                                    endTime.getTime() -
                                                    startTime.getTime();
                                                  const durationMinutes =
                                                    Math.round(
                                                      durationMs / (1000 * 60)
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
                                                            minute: "2-digit",
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
                                                            minute: "2-digit",
                                                          }
                                                        )}
                                                      </span>
                                                      <span className="text-green-400 ml-2">
                                                        ({durationMinutes} min)
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
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #333;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #555;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #666;
        }
      `}</style>
    </Layout>
  );
};

export default ProfilesPage;
