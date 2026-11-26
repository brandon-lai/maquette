import Link from "next/link";

export default function NotFound() {
  return (
    <main className="document-page">
      <Link href="/" className="wordmark">
        maquette
      </Link>
      <h1>This room is not on the plan</h1>
      <p>
        The address does not point to a room. Shared rooms need the complete
        link, including everything after the #.
      </p>
      <Link href="/">Back to the drafting desk</Link>
    </main>
  );
}
