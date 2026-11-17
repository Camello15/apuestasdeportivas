import Link from 'next/link';

interface Selection {
  id: string;
  code: string;
  label: string;
  odds: string;
}

interface Market {
  id: string;
  name: string;
  status: string;
  selections: Selection[];
}

interface Match {
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

async function getMatches(): Promise<Match[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}/matches`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export default async function MatchesPage() {
  const matches = await getMatches();

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Cartelera de Partidos</h1>
          <p className="text-sm text-gray-500">
            Partidos disponibles y mercados abiertos
          </p>
        </div>
      </header>

      {matches.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-gray-500">
          No hay partidos programados en este momento.
        </p>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => {
            const mainMarket = match.markets[0];
            return (
              <article
                key={match.id}
                className="rounded-lg border p-4 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <span className="text-xs font-medium uppercase text-gray-500">
                    {match.competition.country} · {match.competition.name} ·{' '}
                    {match.status}
                  </span>
                  <h2 className="text-lg font-semibold mt-1">
                    {match.homeTeam} vs {match.awayTeam}
                    {match.homeScore !== null && match.awayScore !== null
                      ? ` (${match.homeScore} - ${match.awayScore})`
                      : ''}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {new Date(match.startsAt).toLocaleString('es-EC')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {mainMarket?.selections.map((sel) => (
                    <span
                      key={sel.id}
                      className="rounded border px-3 py-1.5 text-sm font-medium bg-gray-50"
                    >
                      {sel.code}: <strong>{Number(sel.odds).toFixed(2)}</strong>
                    </span>
                  ))}
                  <Link
                    href={`/matches/${match.id}`}
                    className="ml-2 rounded bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
                  >
                    Ver mercados ({match.markets.length})
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}