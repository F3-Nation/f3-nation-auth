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

  if (isEditing) {
    // Edit Mode - Form fields
    return (
      <div className="w-full flex flex-col items-center space-y-6">
        {/* Profile Picture */}
        <ProfilePictureUpload
          currentImageUrl={currentImage}
          onUploadSuccess={handleImageUploadSuccess}
          onDeleteSuccess={handleImageDeleteSuccess}
        />

        {/* Form Fields */}
        <div className="w-full space-y-4">
          {/* F3 Name */}
          <div>
            <label
              htmlFor="f3Name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              F3 Name
            </label>
            <input
              type="text"
              id="f3Name"
              value={f3Name}
              onChange={e => setF3Name(e.target.value)}
              placeholder="Enter your F3 name"
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white"
              disabled={isLoading}
            />
          </div>

          {/* Hospital Name */}
          <div>
            <label
              htmlFor="hospitalName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Hospital Name
            </label>
            <input
              type="text"
              id="hospitalName"
              value={hospitalName}
              onChange={e => setHospitalName(e.target.value)}
              placeholder="Enter your hospital name"
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white"
              disabled={isLoading}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <div className="flex items-center gap-2">
              <p className="text-gray-700 dark:text-gray-300 flex-1">{email}</p>
              <button
                type="button"
                onClick={onEmailChangeClick}
                className="text-sm text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400 font-medium"
              >
                Change
              </button>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-500 text-sm">{success}</p>}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 text-gray-700 dark:text-white font-medium py-2 px-4 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading || !hasChanges}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400 text-white font-medium py-2 px-4 rounded-lg"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View Mode - Clean profile display
  return (
    <div className="w-full flex flex-col items-center space-y-4">
      {/* Profile Picture */}
      <ProfilePictureUpload
        currentImageUrl={currentImage}
        onUploadSuccess={handleImageUploadSuccess}
        onDeleteSuccess={handleImageDeleteSuccess}
      />

      {/* Name Display */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{f3Name}</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">({hospitalName})</p>
      </div>

      {/* Email */}
      <p className="text-sm text-gray-500 dark:text-gray-500">{email}</p>

      {/* Success Message */}
      {success && <p className="text-green-500 text-sm">{success}</p>}

      {/* Edit Button */}
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="w-full max-w-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white font-medium py-2 px-4 rounded-lg"
      >
        Edit Profile
      </button>
    </div>
  );
}
