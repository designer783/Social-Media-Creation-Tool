import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold tracking-tight text-text-primary">Page Not Found</h2>
      <p className="mt-2 text-sm text-text-secondary">Could not find requested resource.</p>
      <Link
        href="/"
        className="mt-4 rounded-md bg-accent-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-primary/90"
      >
        Return Home
      </Link>
    </div>
  );
}
