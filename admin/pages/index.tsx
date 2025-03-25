import { useEffect } from "react";
import { useRouter } from "next/router";
import type { NextPage } from "next";
import Head from "next/head";

const Home: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirect to profiles page on load
    router.push("/profiles");
  }, [router]);

  return (
    <div>
      <Head>
        <title>Redirecting to Profiles - Timey Admin</title>
        <meta name="description" content="Redirecting to user profiles" />
      </Head>
      <div className="flex justify-center items-center h-screen bg-[#333] text-white">
        <div className="text-center">
          <div className="mb-4 text-green-400 text-xl font-bold">
            Timey Admin
          </div>
          <p className="mb-4">Redirecting to user profiles...</p>
          <div className="w-16 h-16 border-t-4 border-green-400 border-solid rounded-full mx-auto animate-spin"></div>
        </div>
      </div>
    </div>
  );
};

export default Home;
