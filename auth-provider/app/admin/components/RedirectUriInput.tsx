'use client';

interface RedirectUriInputProps {
  uris: string[];
  onChange: (uris: string[]) => void;
  disabled?: boolean;
}

export function RedirectUriInput({ uris, onChange, disabled }: RedirectUriInputProps) {
  const addUri = () => {
    onChange([...uris, '']);
  };

  const updateUri = (index: number, value: string) => {
    const newUris = [...uris];
    newUris[index] = value;
    onChange(newUris);
  };

  const removeUri = (index: number) => {
    if (uris.length <= 1) return;
    const newUris = uris.filter((_, i) => i !== index);
    onChange(newUris);
  };

  return (
    <div className="space-y-2">
      {uris.map((uri, index) => (
        <div key={index} className="flex items-center space-x-2">
          <input
            type="url"
            value={uri}
            onChange={e => updateUri(index, e.target.value)}
            placeholder="https://example.com/callback"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={disabled}
            required
          />
          {uris.length > 1 && (
            <button
              type="button"
              onClick={() => removeUri(index)}
              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
              disabled={disabled}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addUri}
        className="text-sm text-green-600 hover:text-green-800 font-medium"
        disabled={disabled}
      >
        + Add another redirect URI
      </button>
    </div>
  );
}
