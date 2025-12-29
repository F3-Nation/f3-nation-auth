import Link from 'next/link';
import { oauthClientRepository } from '@/db';
import { ClientTable } from '../components/ClientTable';

export default async function ClientsPage() {
  const clients = await oauthClientRepository.findAll();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OAuth Clients</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage OAuth clients for third-party applications
          </p>
        </div>
        <Link
          href="/admin/clients/new"
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          Create Client
        </Link>
      </div>

      <ClientTable clients={clients} />
    </div>
  );
}
