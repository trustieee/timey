import React, { useState, useEffect } from "react";
import type { NextPage } from "next";
import Layout from "../components/Layout";
import ProfileList from "../components/ProfileList";
import Auth from "../components/Auth";
import { auth } from "../utils/firebase";
import { onAuthStateChanged } from "firebase/auth";

const ProfilesPage: NextPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <Layout>
      {error && <div className="error-message">{error}</div>}
      {!isAuthenticated ? (
        <Auth setError={setError} loading={loading} setLoading={setLoading} />
      ) : (
        <ProfileList />
      )}
    </Layout>
  );
};

export default ProfilesPage;
