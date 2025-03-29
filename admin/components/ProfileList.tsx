import React, { useState, useEffect } from "react";
import { AdminUserProfile } from "../types";
import ProfileCard from "./ProfileCard";
import { MotionConfig } from "framer-motion";
import { db, auth } from "../utils/firebase";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import ChoresModal from "./ChoresModal";
import CreateUserModal from "./CreateUserModal";
import Auth from "./Auth";
import Head from "next/head";

const ProfileList: React.FC = () => {
  const [profiles, setProfiles] = useState<AdminUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedProfiles, setExpandedProfiles] = useState<
    Record<string, boolean>
  >({});
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // Chores modal state
  const [isChoresModalOpen, setIsChoresModalOpen] = useState(false);
  const [selectedProfileUid, setSelectedProfileUid] = useState<string | null>(
    null
  );

  // Create user modal state
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);

  // Check auth state and admin status on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in
        setIsAuthenticated(true);

        // Check if user is an admin
        try {
          const adminDocRef = doc(db, "adminUsers", user.uid);
          const adminDocSnap = await getDoc(adminDocRef);

          if (adminDocSnap.exists()) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
            setError("Insufficient permissions. You need admin access.");
            setLoading(false);
          }
        } catch (err) {
          console.error("Error checking admin status:", err);
          setIsAdmin(false);
          setError("Failed to verify admin permissions.");
          setLoading(false);
        }
      } else {
        // User is signed out
        setIsAuthenticated(false);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Toggle profile expansion
  const toggleProfileExpansion = (uid: string) => {
    setExpandedProfiles((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  // Toggle day expansion
  const toggleDayExpansion = (uid: string, date: string) => {
    const dayKey = `${uid}-${date}`;
    setExpandedDays((prev) => ({
      ...prev,
      [dayKey]: !prev[dayKey],
    }));
  };

  // Use real-time listener instead of one-time fetch
  const fetchProfilesRealtime = () => {
    try {
      const profilesCollection = collection(db, "playerProfiles");

      // Set up real-time listener
      const unsubscribe = onSnapshot(
        profilesCollection,
        (snapshot) => {
          const profilesData: AdminUserProfile[] = [];

          snapshot.forEach((doc) => {
            const data = doc.data();
            profilesData.push({
              ...data,
              uid: doc.id, // Ensure the document ID is used as the uid
            } as AdminUserProfile);
          });

          setProfiles(profilesData);
          setLoading(false);
        },
        (error) => {
          console.error("Error listening to profiles:", error);
          setError("Failed to sync user profiles in real-time");
          setLoading(false);
        }
      );

      // Return unsubscribe function for cleanup
      return unsubscribe;
    } catch (error) {
      console.error("Error setting up profiles listener:", error);
      setError("Failed to set up real-time sync");
      setLoading(false);
      return () => {
        console.log("No Firebase listener to unsubscribe from");
      };
    }
  };

  // Effect to clean up the listener when component unmounts
  useEffect(() => {
    let unsubscribeProfiles: () => void;

    if (isAuthenticated && isAdmin) {
      unsubscribeProfiles = fetchProfilesRealtime();
    }

    return () => {
      if (unsubscribeProfiles) {
        unsubscribeProfiles();
      }
    };
  }, [isAuthenticated, isAdmin]);

  // Open chores modal for a specific profile
  const openChoresModal = (profile: AdminUserProfile) => {
    setSelectedProfileUid(profile.uid);
    setIsChoresModalOpen(true);
  };

  // Get selected profile
  const selectedProfile = selectedProfileUid
    ? profiles.find((p) => p.uid === selectedProfileUid) || null
    : null;

  return (
    <MotionConfig reducedMotion="user">
      <Head>
        <title>User Profiles - Timey Admin</title>
        <meta name="description" content="Manage user profiles in Timey" />
      </Head>

      <div className="space-y-4">
        {error && (
          <div className="flex items-center bg-red-900/20 backdrop-blur-sm rounded-lg p-3 border border-red-900/50 shadow text-red-300">
            <svg
              className="w-5 h-5 mr-2 text-red-400"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 7V13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {!isAuthenticated ? (
          <Auth setError={setError} loading={loading} setLoading={setLoading} />
        ) : !isAdmin ? (
          <div className="flex items-center bg-red-900/20 backdrop-blur-sm rounded-lg p-4 border border-red-900/50 shadow text-red-300">
            <svg
              className="w-5 h-5 mr-2 text-red-400"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M8 12L10.5 15L16 9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>You are authenticated but don't have admin privileges.</span>
          </div>
        ) : loading ? (
          <div className="flex justify-center items-center h-40 bg-slate-800/50 rounded-lg p-4 border border-slate-700 shadow">
            <div className="flex flex-col items-center">
              <svg
                className="w-8 h-8 text-indigo-400 animate-spin mb-2"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray="32"
                  strokeDashoffset="12"
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-white">Loading player profiles...</p>
            </div>
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex items-center bg-amber-900/20 rounded-lg p-3 border border-amber-900/50 shadow text-amber-300">
            <svg
              className="w-5 h-5 mr-2 text-amber-400"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 7V13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            <span>No user profiles found.</span>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-lg shadow p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-indigo-400 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M17 8C17 10.7614 14.7614 13 12 13C9.23858 13 7 10.7614 7 8C7 5.23858 9.23858 3 12 3C14.7614 3 17 5.23858 17 8Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 21C3 18 7 15 12 15C17 15 21 18 21 21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Player Profiles
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Managing {profiles.length} profile
                    {profiles.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateUserModalOpen(true)}
                className="flex items-center px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
              >
                <svg
                  className="w-4 h-4 mr-1.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 4V20M4 12H20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Create User
              </button>
            </div>

            <div className="space-y-4">
              {profiles.map((profile) => (
                <ProfileCard
                  key={profile.uid}
                  profile={profile}
                  isExpanded={expandedProfiles[profile.uid] || false}
                  expandedDays={expandedDays}
                  toggleProfileExpansion={toggleProfileExpansion}
                  toggleDayExpansion={toggleDayExpansion}
                  openChoresModal={openChoresModal}
                />
              ))}
            </div>
          </div>
        )}

        {/* Create User Modal */}
        <CreateUserModal
          isOpen={isCreateUserModalOpen}
          onClose={() => setIsCreateUserModalOpen(false)}
        />

        {/* Chores Modal */}
        {isChoresModalOpen && selectedProfile && (
          <ChoresModal
            isOpen={isChoresModalOpen}
            onClose={() => setIsChoresModalOpen(false)}
            selectedProfile={selectedProfile}
            profiles={profiles}
            setProfiles={setProfiles}
            setError={setError}
          />
        )}
      </div>
    </MotionConfig>
  );
};

export default ProfileList;
