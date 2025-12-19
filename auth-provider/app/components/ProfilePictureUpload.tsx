'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
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
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    }

    if (showOptions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOptions]);

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

    setShowOptions(false);
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

    setShowOptions(false);
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
    <div className="flex flex-col items-center">
      {/* Tappable Profile Picture */}
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setShowOptions(true)}
          disabled={isUploading || isDeleting}
          className="relative w-24 h-24 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-full"
          aria-label="Change profile photo"
        >
          {displayUrl ? (
            <Image
              src={displayUrl}
              alt="Profile picture"
              fill
              className="rounded-full object-cover"
              unoptimized={!!previewUrl}
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

          {/* Camera icon overlay */}
          <div className="absolute bottom-0 right-0 bg-gray-800 rounded-full p-1.5 border-2 border-gray-900 group-hover:bg-gray-700 transition-colors">
            <svg
              className="w-3.5 h-3.5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>

          {/* Loading overlay */}
          {(isUploading || isDeleting) && (
            <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </button>

        {/* Popover menu */}
        {showOptions && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-10 min-w-[140px]">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 text-left"
            >
              Change Photo
            </button>
            {currentImageUrl && (
              <button
                type="button"
                onClick={handleDelete}
                className="w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left border-t border-gray-100"
              >
                Remove Photo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        disabled={isUploading || isDeleting}
        className="hidden"
      />

      {/* Error Message */}
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}
