import { Suspense } from "react";
import { login } from "../actions";

export const metadata = { title: "Logg inn · Coche" };

async function ErrorMessage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return error ? <p className="text-sm text-bad">Feil passord</p> : null;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <form action={login} className="w-full max-w-xs space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Coche</h1>
        <input
          type="password"
          name="password"
          autoFocus
          required
          placeholder="Passord"
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
        />
        <Suspense>
          <ErrorMessage searchParams={searchParams} />
        </Suspense>
        <button className="w-full rounded-lg bg-accent px-3 py-2 font-medium text-white hover:opacity-90">Logg inn</button>
      </form>
    </main>
  );
}
