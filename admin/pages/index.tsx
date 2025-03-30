import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { NextPage } from "next";
import Head from "next/head";
import { auth, db } from "../utils/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const Home: NextPage = () => {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState(
    "Checking authentication..."
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, now check if they're an admin
        setStatusMessage("Verifying admin permissions...");

        try {
          const adminDocRef = doc(db, "adminUsers", user.uid);
          const adminDocSnap = await getDoc(adminDocRef);

          if (adminDocSnap.exists()) {
            setStatusMessage("Access granted, redirecting...");
            // Only redirect if user is an admin
            router.push("/profiles");
          } else {
            // Log them out and redirect to login
            await signOut(auth);
            router.push("/profiles");
          }
        } catch (err) {
          // On error, log them out and redirect to login
          await signOut(auth);
          router.push("/profiles");
        }
      } else {
        // User is not authenticated, redirect to profiles page to show login
        router.push("/profiles");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div>
      <Head>
        <title>Admin Dashboard - Timey</title>
        <meta name="description" content="Timey Administration Dashboard" />
      </Head>
      <div className="flex justify-center items-center h-screen bg-slate-950 text-white">
        <div className="text-center">
          <div className="mb-4 text-indigo-400 text-xl font-bold">
            Timey Admin
          </div>
          <p className="mb-4">{statusMessage}</p>
          <div className="w-16 h-16 border-t-4 border-indigo-400 border-solid rounded-full mx-auto animate-spin"></div>
        </div>
      </div>
    </div>
  );
};

export default Home;
