import React, { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "../utils/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth state on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

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
