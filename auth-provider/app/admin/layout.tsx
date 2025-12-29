import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { AdminNav } from './components/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin');
  }

  // Show 403 if authenticated but not admin
  if (!isAdmin(session.user.email)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-4xl font-bold text-red-600">403</h1>
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-gray-600">
            You do not have permission to access the admin dashboard. Please contact an
            administrator if you believe this is an error.
          </p>
          <Link
            href="/"
            className="inline-block mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50">
      <AdminNav userEmail={session.user.email} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
    </div>
  );
}
