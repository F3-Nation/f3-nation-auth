'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClientForm } from '../../components/ClientForm';
import { CopyButton } from '../../components/CopyButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface OAuthClient {
  id: string;
  name: string;
  clientSecret: string;
  redirectUris: string;
  allowedOrigin: string;
  scopes: string;
  createdAt: string;
  isActive: boolean;
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<OAuthClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const fetchClient = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/clients/${id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch client');
      }

      setClient(result.client);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch client');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  const handleUpdate = async (data: {
    name: string;
    redirectUris: string[];
    allowedOrigin: string;
    scopes: string[];
  }) => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch(`/api/admin/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update client');
      }

      setClient(result.client);
      setSuccessMessage('Client updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!client) return;

    setIsSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !client.isActive }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update client status');
      }

      setClient(result.client);
      setSuccessMessage(`Client ${result.client.isActive ? 'activated' : 'deactivated'}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client status');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteDialog(false);
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/clients/${id}?permanent=true`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete client');
      }

      router.push('/admin/clients');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete client');
      setIsSaving(false);
    }
  };

  const handleRegenerateSecret = async () => {
    setShowRegenerateDialog(false);
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/clients/${id}/regenerate-secret`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to regenerate secret');
      }

      setNewSecret(result.client.clientSecret);
      setClient(result.client);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate secret');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Client Not Found</h1>
        <p className="mt-2 text-gray-500">The requested OAuth client could not be found.</p>
        <Link
          href="/admin/clients"
          className="inline-block mt-4 text-green-600 hover:text-green-800"
        >
          Back to Clients
        </Link>
      </div>
    );
  }

  const redirectUris = JSON.parse(client.redirectUris);
  const scopes = client.scopes.split(' ');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/clients" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back to Clients
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* New Secret Alert */}
      {newSecret && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5"
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
            <div className="flex-1">
              <p className="font-medium text-yellow-800">New Secret Generated</p>
              <p className="text-sm text-yellow-700 mt-1">
                Save this secret now - it will not be displayed again.
              </p>
              <div className="mt-2 flex items-center space-x-2">
                <code className="flex-1 bg-white px-3 py-2 rounded border text-sm font-mono break-all">
                  {newSecret}
                </code>
                <CopyButton text={newSecret} />
              </div>
              <button
                onClick={() => setNewSecret(null)}
                className="mt-2 text-sm text-yellow-700 hover:text-yellow-900"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Details Card */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            <span
              className={`px-3 py-1 text-sm font-semibold rounded-full ${
                client.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {client.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <ClientForm
            initialData={{
              name: client.name,
              redirectUris,
              allowedOrigin: client.allowedOrigin,
              scopes,
            }}
            onSubmit={handleUpdate}
            isLoading={isSaving}
            submitLabel="Save Changes"
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Credentials Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Credentials</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-xs break-all">
                    {client.id}
                  </code>
                  <CopyButton text={client.id} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
                </label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-xs break-all">
                    {client.clientSecret}
                  </code>
                  <CopyButton text={client.clientSecret} />
                </div>
              </div>

              <button
                onClick={() => setShowRegenerateDialog(true)}
                disabled={isSaving}
                className="w-full mt-2 px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-lg disabled:opacity-50"
              >
                Regenerate Secret
              </button>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Info</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">{new Date(client.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          {/* Actions Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={handleToggleActive}
                disabled={isSaving}
                className={`w-full px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${
                  client.isActive
                    ? 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200'
                    : 'text-green-700 bg-green-100 hover:bg-green-200'
                }`}
              >
                {client.isActive ? 'Deactivate Client' : 'Activate Client'}
              </button>

              <button
                onClick={() => setShowDeleteDialog(true)}
                disabled={isSaving}
                className="w-full px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg disabled:opacity-50"
              >
                Delete Client
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Client"
        message={`Are you sure you want to permanently delete "${client.name}"? This action cannot be undone and will invalidate all existing tokens.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showRegenerateDialog}
        title="Regenerate Secret"
        message="Are you sure you want to regenerate the client secret? The old secret will immediately stop working for all applications using it."
        confirmLabel="Regenerate"
        onConfirm={handleRegenerateSecret}
        onCancel={() => setShowRegenerateDialog(false)}
        variant="warning"
      />
    </div>
  );
}
