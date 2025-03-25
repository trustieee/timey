import type { NextPage } from "next";
import Head from "next/head";
import Layout from "../components/Layout";

const Home: NextPage = () => {
  return (
    <Layout>
      <Head>
        <title>Timey Admin Dashboard</title>
        <meta
          name="description"
          content="Admin dashboard for Timey application"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="bg-[#222] shadow-lg rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-4 text-green-400 border-b border-gray-700 pb-2">
          Welcome to Timey Admin
        </h1>
        <p className="mb-4 text-gray-300">
          This dashboard allows you to manage user profiles and application data
          for the Timey time management app.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <div className="bg-[rgba(33,150,243,0.2)] p-4 rounded-lg shadow border border-blue-900 hover:bg-[rgba(33,150,243,0.3)] transition-colors">
            <h2 className="text-xl font-bold mb-2 text-blue-400">
              User Management
            </h2>
            <p className="text-gray-300">View and manage user accounts</p>
          </div>
          <div className="bg-[rgba(76,175,80,0.2)] p-4 rounded-lg shadow border border-green-900 hover:bg-[rgba(76,175,80,0.3)] transition-colors">
            <h2 className="text-xl font-bold mb-2 text-green-400">
              Profile Data
            </h2>
            <p className="text-gray-300">
              Manage user profile information and game progress
            </p>
          </div>
          <div className="bg-[rgba(156,39,176,0.2)] p-4 rounded-lg shadow border border-purple-900 hover:bg-[rgba(156,39,176,0.3)] transition-colors">
            <h2 className="text-xl font-bold mb-2 text-purple-400">
              System Stats
            </h2>
            <p className="text-gray-300">
              View system statistics and performance metrics
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Home;
