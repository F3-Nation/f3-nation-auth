'use client';

import { useState } from 'react';
import { RedirectUriInput } from './RedirectUriInput';

interface ClientFormData {
  name: string;
  redirectUris: string[];
  allowedOrigin: string;
  scopes: string[];
}

interface ClientFormProps {
  initialData?: ClientFormData;
  onSubmit: (data: ClientFormData) => Promise<void>;
  isLoading: boolean;
  submitLabel: string;
}

const AVAILABLE_SCOPES = ['openid', 'profile', 'email'];

export function ClientForm({ initialData, onSubmit, isLoading, submitLabel }: ClientFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [redirectUris, setRedirectUris] = useState<string[]>(initialData?.redirectUris ?? ['']);
  const [allowedOrigin, setAllowedOrigin] = useState(initialData?.allowedOrigin ?? '');
  const [scopes, setScopes] = useState<string[]>(
    initialData?.scopes ?? ['openid', 'profile', 'email']
  );

  const handleScopeChange = (scope: string, checked: boolean) => {
    if (checked) {
      setScopes([...scopes, scope]);
    } else {
      setScopes(scopes.filter(s => s !== scope));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filteredUris = redirectUris.filter(uri => uri.trim() !== '');
    if (filteredUris.length === 0) {
      return;
    }
    await onSubmit({
      name: name.trim(),
      redirectUris: filteredUris,
      allowedOrigin: allowedOrigin.trim(),
      scopes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Client Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="My Application"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={isLoading}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Redirect URIs</label>
        <RedirectUriInput uris={redirectUris} onChange={setRedirectUris} disabled={isLoading} />
      </div>

      <div>
        <label htmlFor="allowedOrigin" className="block text-sm font-medium text-gray-700 mb-1">
          Allowed Origin
        </label>
        <input
          type="url"
          id="allowedOrigin"
          value={allowedOrigin}
          onChange={e => setAllowedOrigin(e.target.value)}
          placeholder="https://example.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={isLoading}
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          The origin (scheme + host + port) that is allowed to make requests
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Scopes</label>
        <div className="space-y-2">
          {AVAILABLE_SCOPES.map(scope => (
            <label key={scope} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={scopes.includes(scope)}
                onChange={e => handleScopeChange(scope, e.target.checked)}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                disabled={isLoading}
              />
              <span className="text-sm text-gray-700">{scope}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={isLoading || !name.trim() || !allowedOrigin.trim()}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg"
        >
          {isLoading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
