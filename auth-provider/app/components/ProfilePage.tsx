'use client';
import { useState } from 'react';
import ProfileSettingsForm from './ProfileSettingsForm';
import EmailChangeModal from './EmailChangeModal';
import SignOutButton from './SignOutButton';

interface ProfilePageProps {
  user: {
    f3Name: string;
    hospitalName: string;
    email: string;
    image: string | null;
  };
}

export default function ProfilePage({ user }: ProfilePageProps) {
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-6">
        <ProfileSettingsForm
          initialF3Name={user.f3Name}
          initialHospitalName={user.hospitalName}
          initialImage={user.image}
          email={user.email}
          onEmailChangeClick={() => setIsEmailModalOpen(true)}
        />

        <SignOutButton />
      </div>

      <EmailChangeModal
        currentEmail={user.email}
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
      />
    </div>
  );
}
