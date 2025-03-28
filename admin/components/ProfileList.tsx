import React from "react";
import { AdminUserProfile } from "../types";
import ProfileCard from "./ProfileCard";

interface ProfileListProps {
  profiles: AdminUserProfile[];
  expandedProfiles: Record<string, boolean>;
  expandedDays: Record<string, boolean>;
  toggleProfileExpansion: (uid: string) => void;
  toggleDayExpansion: (uid: string, date: string) => void;
  openChoresModal: (profile: AdminUserProfile) => void;
}

const ProfileList: React.FC<ProfileListProps> = ({
  profiles,
  expandedProfiles,
  expandedDays,
  toggleProfileExpansion,
  toggleDayExpansion,
  openChoresModal,
}) => {
  return (
    <div className="space-y-4">
      {profiles.map((profile) => (
        <ProfileCard
          key={profile.uid}
          profile={profile}
          isExpanded={expandedProfiles[profile.uid] || false}
          expandedDays={expandedDays}
          toggleProfileExpansion={toggleProfileExpansion}
          toggleDayExpansion={toggleDayExpansion}
          openChoresModal={openChoresModal}
        />
      ))}
    </div>
  );
};

export default ProfileList;
