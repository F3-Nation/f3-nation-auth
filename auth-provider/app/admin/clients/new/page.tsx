'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ClientForm } from '../../components/ClientForm';
import { CopyButton } from '../../components/CopyButton';

interface CreatedClient {
  id: string;
  name: string;
  clientSecret: string;
}

export default function NewClientPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdClient, setCreatedClient] = useState<CreatedClient | null>(null);

  const handleSubmit = async (data: {
    name: string;
    redirectUris: string[];
    allowedOrigin: string;
    scopes: string[];
  }) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create client');
      }

      // Show the created client with credentials
      setCreatedClient({
        id: result.client.id,
        name: result.client.name,
        clientSecret: result.client.clientSecret,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setIsLoading(false);
    }
  };

  // Show success screen with credentials
  if (createdClient) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Client Created!</h1>
            <p className="mt-2 text-gray-600">
              Your OAuth client has been created successfully. Save the credentials below - the
              secret will not be shown again.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg
                className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-sm text-yellow-800">
                Save these credentials now! The client secret will not be displayed again.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
              <p className="text-gray-900">{createdClient.name}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 bg-gray-100 px-3 py-2 rounded-lg text-sm break-all">
                  {createdClient.id}
                </code>
                <CopyButton text={createdClient.id} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 bg-gray-100 px-3 py-2 rounded-lg text-sm break-all font-mono">
                  {createdClient.clientSecret}
                </code>
                <CopyButton text={createdClient.clientSecret} />
              </div>
            </div>
          </div>

          <div className="mt-8 flex space-x-4">
            <Link
              href={`/admin/clients/${createdClient.id}`}
              className="flex-1 text-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              View Client
            </Link>
            <Link
              href="/admin/clients"
              className="flex-1 text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Back to Clients
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/clients" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back to Clients
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create OAuth Client</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <ClientForm onSubmit={handleSubmit} isLoading={isLoading} submitLabel="Create Client" />
      </div>
    </div>
  );
}
