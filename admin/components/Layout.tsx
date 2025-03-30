import React, { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { auth, db } from "../utils/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import Auth from "./Auth";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
            setLoading(false);
          } else {
            setIsAdmin(false);
            // Log them out if they're not an admin
            await signOut(auth);
            setIsAuthenticated(false);
            setLoading(false);
          }
        } catch (err) {
          setIsAdmin(false);
          setError("Permission verification failed. Please try again.");

          // Log them out if there's an error checking admin status
          await signOut(auth);
          setIsAuthenticated(false);
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

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // If still loading, show a loading indicator
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
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
          <p className="text-white">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Show login form for non-authenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950">
        <div className="container mx-auto p-3 md:p-4">
          <div className="max-w-md mx-auto">
            <h1 className="text-xl font-bold text-white mb-8 text-center">
              Timey Admin Dashboard
            </h1>
            {error && (
              <div className="mb-4 p-3 border border-red-700 bg-red-900/30 text-red-300 rounded-md text-sm">
                <div className="flex items-center space-x-2">
                  <svg
                    className="h-4 w-4 text-red-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <header className="bg-slate-900 text-white p-3 shadow border-b border-slate-800">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <svg
              className="w-5 h-5 text-indigo-400"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 8V12L15 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <h1 className="text-lg font-bold text-white">
              Timey Admin{" "}
              <span className="text-sm text-slate-400">
                v{process.env.NEXT_PUBLIC_APP_VERSION}
              </span>
              {isAdmin && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-indigo-500 text-white rounded-md">
                  Admin
                </span>
              )}
            </h1>
          </div>
          <nav className="flex items-center">
            <ul className="flex space-x-4">
              <li className="text-indigo-300 font-medium hover:text-indigo-200 transition-colors">
                <Link href="/profiles">Profiles</Link>
              </li>
              {isAuthenticated && (
                <li className="text-indigo-300 font-medium hover:text-indigo-200 transition-colors flex items-center cursor-pointer">
                  <button onClick={handleLogout} className="flex items-center">
                    <svg
                      className="w-3.5 h-3.5 mr-1 opacity-80"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M15 3H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H15"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M18 15L21 12M21 12L18 9M21 12H9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Logout
                  </button>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>
      <main className="flex-grow container mx-auto p-3 md:p-4">{children}</main>
      <footer className="bg-slate-900 text-white p-3 text-xs border-t border-slate-800">
        <div className="container mx-auto text-center">
          <p className="flex items-center justify-center">
            <span className="text-slate-400">
              Timey Admin Dashboard &copy; {new Date().getFullYear()}
            </span>
            <span className="mx-2 text-indigo-500">•</span>
            <span className="text-indigo-300">User Profile Management</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
