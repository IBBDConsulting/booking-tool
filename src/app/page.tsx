export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-lg mx-auto px-6">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">
          Booking Platform
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Dein Buchungssystem läuft! Jetzt kannst du es weiter ausbauen.
        </p>
        <div className="space-y-3">
          <a
            href="/book/demo"
            className="block w-full rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
          >
            Buchungsseite ansehen
          </a>
          <a
            href="/dashboard"
            className="block w-full rounded-lg bg-white border border-gray-300 px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition"
          >
            Admin Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
