import { useState, useEffect } from "react";
import type { NextPage } from "next";
import Head from "next/head";
import Layout from "../components/Layout";

// This is a placeholder since client-side Firebase admin SDK doesn't allow listing users
// In a real app, you would need a backend API to get this data
interface User {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
}

const UsersPage: NextPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, you would fetch users from a backend API
    // This is just placeholder data
    const mockUsers: User[] = [
      {
        uid: "1",
        email: "user1@example.com",
        displayName: "User One",
        createdAt: new Date().toISOString(),
      },
      {
        uid: "2",
        email: "user2@example.com",
        displayName: "User Two",
        createdAt: new Date().toISOString(),
      },
    ];

    // Simulate API call
    setTimeout(() => {
      setUsers(mockUsers);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <Layout>
      <Head>
        <title>Users - Timey Admin</title>
        <meta name="description" content="Manage users in Timey" />
      </Head>

      <div className="bg-[#222] shadow-lg rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-6 text-green-400 border-b border-gray-700 pb-2">
          User Management
        </h1>

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <p className="text-lg text-gray-300">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-[#333] rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#444] border-b border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold text-sm text-green-400">
                    UID
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-green-400">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-green-400">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-green-400">
                    Created
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-green-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.uid}
                    className="border-b border-gray-700 hover:bg-[#3a3a3a] transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-sm">{user.uid}</td>
                    <td className="py-3 px-4">{user.email}</td>
                    <td className="py-3 px-4">{user.displayName}</td>
                    <td className="py-3 px-4 text-gray-300">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <button className="bg-[#2196F3] text-white px-3 py-1 rounded mr-2 hover:bg-blue-600 transition-colors">
                        View
                      </button>
                      <button className="bg-[#f44336] text-white px-3 py-1 rounded hover:bg-red-600 transition-colors">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default UsersPage;
