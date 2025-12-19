'use client';
import { useState } from 'react';
import ThemeImage from './ThemeImage';
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
        <div className="flex flex-col items-center space-y-4">
          {user.image ? (
            <ThemeImage
              src={user.image}
              alt="Profile picture"
              width={80}
              height={80}
              className="rounded-full"
            />
          ) : (
            <ThemeImage
              src="/f3nation.svg"
              alt="Profile picture"
              width={80}
              height={80}
              className="rounded-full"
              priority
            />
          )}
        </div>

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
