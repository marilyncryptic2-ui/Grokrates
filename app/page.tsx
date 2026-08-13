export const dynamic = 'force-dynamic';
import { buildSnapshotFromSheet } from '../lib/engine';
import { RouteDisplay } from '../components/RouteDisplay';

export const revalidate = 60; // Refresh data every 60 seconds

export default async function Page() {
  // Fetch snapshot built directly from Google Sheet PoolData CSV
  const snapshot = await buildSnapshotFromSheet({}, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">YieldBoard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-venue yield engine • {snapshot.poolCount} active pools loaded
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          Last Synced: {new Date(snapshot.updatedAt).toLocaleTimeString()}
        </div>
      </div>

      {/* Multi-Venue Routes Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-200">Optimal Multi-Venue Routes</h2>
        <div className="grid grid-cols-1 gap-6">
          {snapshot.routes && snapshot.routes.length > 0 ? (
            snapshot.routes.map((route, idx) => (
              <RouteDisplay key={idx} route={route} />
            ))
          ) : (
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 text-slate-400 text-sm">
              No optimal leverage routes available for current pool parameters.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
