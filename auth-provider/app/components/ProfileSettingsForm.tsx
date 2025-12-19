'use client';
import { useState, useEffect } from 'react';
import ProfilePictureUpload from './ProfilePictureUpload';

interface ProfileSettingsFormProps {
  initialF3Name: string;
  initialHospitalName: string;
  initialImage: string | null;
  email: string;
  onEmailChangeClick: () => void;
}

export default function ProfileSettingsForm({
  initialF3Name,
  initialHospitalName,
  initialImage,
  email,
  onEmailChangeClick,
}: ProfileSettingsFormProps) {
  const [f3Name, setF3Name] = useState(initialF3Name);
  const [hospitalName, setHospitalName] = useState(initialHospitalName);
  const [currentImage, setCurrentImage] = useState(initialImage);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Track if any changes have been made (image is handled separately)
  const hasChanges = f3Name !== initialF3Name || hospitalName !== initialHospitalName;

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSave = async () => {
    if (!f3Name.trim()) {
      setError('F3 name is required');
      return;
    }
    if (!hospitalName.trim()) {
      setError('Hospital name is required');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData: { f3Name?: string; hospitalName?: string } = {};

      if (f3Name !== initialF3Name) {
        updateData.f3Name = f3Name.trim();
      }
      if (hospitalName !== initialHospitalName) {
        updateData.hospitalName = hospitalName.trim();
      }

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccess('Profile updated successfully');
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setF3Name(initialF3Name);
    setHospitalName(initialHospitalName);
    setIsEditing(false);
    setError('');
  };

  const handleImageUploadSuccess = (newImageUrl: string) => {
    setCurrentImage(newImageUrl);
  };

  const handleImageDeleteSuccess = () => {
    setCurrentImage(null);
  };

  return (
    <div className="w-full space-y-4">
      {/* Profile Picture */}
      <div className="pb-2">
        <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
          Profile Picture
        </label>
        <ProfilePictureUpload
          currentImageUrl={currentImage}
          onUploadSuccess={handleImageUploadSuccess}
          onDeleteSuccess={handleImageDeleteSuccess}
        />
      </div>

      {/* F3 Name */}
      <div>
        <label htmlFor="f3Name" className="block text-sm font-medium text-gray-700 mb-1">
          F3 Name
        </label>
        {isEditing ? (
          <input
            type="text"
            id="f3Name"
            value={f3Name}
            onChange={e => setF3Name(e.target.value)}
            placeholder="Enter your F3 name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isLoading}
          />
        ) : (
          <p className="text-lg font-semibold">{f3Name}</p>
        )}
      </div>

      {/* Hospital Name */}
      <div>
        <label htmlFor="hospitalName" className="block text-sm font-medium text-gray-700 mb-1">
          Hospital Name
        </label>
        {isEditing ? (
          <input
            type="text"
            id="hospitalName"
            value={hospitalName}
            onChange={e => setHospitalName(e.target.value)}
            placeholder="Enter your hospital name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isLoading}
          />
        ) : (
          <p className="text-lg">{hospitalName}</p>
        )}
      </div>

      {/* Email (read-only with change button) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <div className="flex items-center gap-2">
          <p className="text-gray-600 flex-1">{email}</p>
          <button
            type="button"
            onClick={onEmailChangeClick}
            className="text-sm text-green-600 hover:text-green-700 font-medium"
          >
            Change
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">{success}</p>}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading || !hasChanges}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg"
          >
            Edit Profile
          </button>
        )}
      </div>
    </div>
  );
}
