'use client';
import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';

interface ProfilePictureUploadProps {
  currentImageUrl: string | null;
  onUploadSuccess: (newImageUrl: string) => void;
  onDeleteSuccess: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (before compression)
const TARGET_SIZE = 400;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ProfilePictureUpload({
  currentImageUrl,
  onUploadSuccess,
  onDeleteSuccess,
}: ProfilePictureUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = useCallback(async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > TARGET_SIZE) {
            height = Math.round((height * TARGET_SIZE) / width);
            width = TARGET_SIZE;
          }
        } else {
          if (height > TARGET_SIZE) {
            width = Math.round((width * TARGET_SIZE) / height);
            height = TARGET_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          blob => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/webp',
          0.85
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please select a JPEG, PNG, or WebP image');
      return;
    }

    // Validate file size (before compression)
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      // Compress the image
      const compressedBlob = await compressImage(file);

      // Create preview
      const preview = URL.createObjectURL(compressedBlob);
      setPreviewUrl(preview);

      // Upload
      const formData = new FormData();
      formData.append('file', compressedBlob, 'avatar.webp');

      const response = await fetch('/api/profile/picture', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      onUploadSuccess(data.imageUrl);
      setPreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!currentImageUrl) return;

    setIsDeleting(true);
    setError('');

    try {
      const response = await fetch('/api/profile/picture', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete image');
      }

      onDeleteSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    } finally {
      setIsDeleting(false);
    }
  };

  const displayUrl = previewUrl || currentImageUrl;

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Image Preview */}
      <div className="relative w-24 h-24">
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt="Profile picture"
            fill
            className="rounded-full object-cover"
            unoptimized={!!previewUrl} // Don't optimize blob URLs
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
        )}
        {isUploading && (
          <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Upload/Delete Buttons */}
      <div className="flex gap-2">
        <label className="cursor-pointer">
          <span className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg inline-block">
            {isUploading ? 'Uploading...' : 'Change Photo'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            disabled={isUploading || isDeleting}
            className="hidden"
          />
        </label>

        {currentImageUrl && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isUploading || isDeleting}
            className="bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50"
          >
            {isDeleting ? 'Removing...' : 'Remove'}
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
