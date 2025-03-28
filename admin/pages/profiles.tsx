import React, { useState, useEffect } from "react";
import type { NextPage } from "next";
import Head from "next/head";
import Layout from "../components/Layout";
import { db, auth } from "../utils/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { AdminUserProfile } from "../types";
import Auth from "../components/Auth";
import ProfileList from "../components/ProfileList";
import ChoresModal from "../components/ChoresModal";

const ProfilesPage: NextPage = () => {
  const [profiles, setProfiles] = useState<AdminUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [expandedProfiles, setExpandedProfiles] = useState<
    Record<string, boolean>
  >({});
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // Chores modal state
  const [isChoresModalOpen, setIsChoresModalOpen] = useState(false);
  const [selectedProfileUid, setSelectedProfileUid] = useState<string | null>(
    null
  );

  // Check auth state on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in
        setIsAuthenticated(true);
      } else {
        // User is signed out
        setIsAuthenticated(false);
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
            profilesData.push({
              uid: doc.id,
              ...doc.data(),
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
      // Return a no-op function that satisfies the type requirement
      return () => {
        // No operation needed in the fallback case
        console.log("No Firebase listener to unsubscribe from");
      };
    }
  };

  // Effect to clean up the listener when component unmounts
  useEffect(() => {
    let unsubscribeProfiles: () => void;

    if (isAuthenticated) {
      unsubscribeProfiles = fetchProfilesRealtime();
    }

    return () => {
      if (unsubscribeProfiles) {
        unsubscribeProfiles();
      }
    };
  }, [isAuthenticated]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Auth state listener will update the state
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

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
    <Layout>
      <Head>
        <title>User Profiles - Timey Admin</title>
        <meta name="description" content="Manage user profiles in Timey" />
      </Head>

      <div className="bg-[#222] shadow-lg rounded-lg p-6 text-white">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
          <h1 className="text-2xl font-bold text-green-400">
            User Profiles {profiles.length > 0 && `(${profiles.length})`}
          </h1>
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white transition-colors"
            >
              Logout
            </button>
          )}
        </div>

        {!isAuthenticated ? (
          <div className="bg-[rgba(244,67,54,0.2)] text-red-400 p-3 mb-4 rounded border border-red-900">
            {error && error}
          </div>
        ) : null}

        {!isAuthenticated ? (
          <Auth setError={setError} loading={loading} setLoading={setLoading} />
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
          <ProfileList
            profiles={profiles}
            expandedProfiles={expandedProfiles}
            expandedDays={expandedDays}
            toggleProfileExpansion={toggleProfileExpansion}
            toggleDayExpansion={toggleDayExpansion}
            openChoresModal={openChoresModal}
          />
        )}
      </div>

      {/* Chores Management Modal */}
      <ChoresModal
        isOpen={isChoresModalOpen}
        onClose={() => setIsChoresModalOpen(false)}
        selectedProfile={selectedProfile}
        profiles={profiles}
        setProfiles={setProfiles}
        setError={setError}
      />

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(51, 51, 51, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(85, 85, 85, 0.7);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(102, 102, 102, 0.8);
        }
        .chores-list {
          scrollbar-width: thin;
          scrollbar-color: rgba(85, 85, 85, 0.7) rgba(51, 51, 51, 0.5);
        }
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: scale(0.98);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
    </Layout>
  );
};

export default ProfilesPage;
