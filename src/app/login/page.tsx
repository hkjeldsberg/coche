import { Suspense } from "react";
import { login } from "../actions";

export const metadata = { title: "Logg inn · Coche" };

async function ErrorMessage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return error ? <p className="text-sm font-semibold text-must">Feil passord</p> : null;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form action={login} className="card w-full max-w-sm space-y-5 p-6">
        <div>
          <p className="eyebrow">Coche</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Logg inn</h1>
        </div>
        <input
          type="password"
          name="password"
          autoFocus
          required
          autoComplete="current-password"
          placeholder="Passord"
          className="min-h-11 w-full rounded-full border border-line-strong bg-ground px-4 text-base outline-none placeholder:text-muted focus:border-accent"
        />
        <Suspense>
          <ErrorMessage searchParams={searchParams} />
        </Suspense>
        <button className="btn btn-primary w-full">Logg inn</button>
      </form>
    </main>
  );
}
