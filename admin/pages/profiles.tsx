import React from "react";
import type { NextPage } from "next";
import Layout from "../components/Layout";
import ProfileList from "../components/ProfileList";

const ProfilesPage: NextPage = () => {
  return (
    <Layout>
      <ProfileList />
    </Layout>
  );
};

export default ProfilesPage;
