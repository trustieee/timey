import React, { ReactNode } from "react";
import Link from "next/link";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#222] text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">
            Timey Admin <span className="text-sm opacity-70">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          </h1>
          <nav>
            <ul className="flex space-x-6">
              <li className="text-green-400 font-semibold">
                <Link href="/profiles">Profiles</Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main className="flex-grow container mx-auto p-4">{children}</main>
      <footer className="bg-[#222] text-white p-4 text-sm">
        <div className="container mx-auto text-center">
          <p>
            Timey Admin Dashboard &copy; {new Date().getFullYear()} |
            <span className="text-green-400 ml-2">User Profile Management</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
