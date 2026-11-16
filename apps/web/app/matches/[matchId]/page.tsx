import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Selection {
  id: string;
  code: string;
  label: string;
  odds: string;
}

interface Market {
  id: string;
  type: string;
  name: string;
  status: string;
  selections: Selection[];
}

interface MatchDetail {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  competition: { name: string; country: string };
  markets: Market[];
}

async function getMatch(matchId: string): Promise<MatchDetail | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/matches/${matchId}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const match = await getMatch(matchId);

  if (!match) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <Link href="/matches" className="text-sm text-blue-600 hover:underline">
        ← Volver a la cartelera
      </Link>

      <header className="rounded-lg border p-5">
        <p className="text-xs font-medium uppercase text-gray-500">
          {match.competition.country} · {match.competition.name} ·{' '}
          {match.status}
        </p>
        <h1 className="text-2xl font-bold mt-1">
          {match.homeTeam} vs {match.awayTeam}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Inicio: {new Date(match.startsAt).toLocaleString('es-EC')}
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Mercados disponibles</h2>
        {match.markets.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-gray-500">
            Aún no hay mercados configurados para este partido.
          </p>
        ) : (
          match.markets.map((market) => (
            <div key={market.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{market.name}</h3>
                <span className="text-xs rounded bg-gray-100 px-2 py-0.5">
                  {market.status}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {market.selections.map((sel) => (
                  <button
                    key={sel.id}
                    type="button"
                    disabled={market.status !== 'OPEN'}
                    className="flex items-center justify-between rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span>{sel.label}</span>
                    <strong className="font-mono">
                      {Number(sel.odds).toFixed(2)}
                    </strong>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}