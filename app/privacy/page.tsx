import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Your room's privacy | Maquette" };
export default function PrivacyPage() {
  return (
    <main className="document-page">
      <Link href="/" className="wordmark">
        maquette
      </Link>
      <h1>Your room stays yours</h1>
      <p>
        Rooms and furniture save in your browser, without an account. Floor-plan
        uploads are processed on your device and are not stored on our server.
        Clear the saved room in Settings or your browser’s site-data controls.
      </p>
      <h2>Sharing is a deliberate snapshot</h2>
      <p>
        A view-only share link contains the room data in its URL fragment. The
        hosting server does not receive that fragment. Anyone holding the link
        can read it, including its room name and address. Leave private details
        out. Later edits do not update an existing link.
      </p>
      <h2>Product links contact the store</h2>
      <p>
        Import sends the product URL to Maquette’s server, which requests its
        public page. Product metadata may be cached in server memory for fifteen
        minutes. Loading a product image can contact its retailer. We do not
        bypass logins or retailer access controls.
      </p>
      <h2>No invisible measurement</h2>
      <p>
        There are no analytics, tracking cookies, payments or raw IP database
        columns. Vercel and retailers may process ordinary network logs under
        their own policies. Maquette does not promise that third parties collect
        nothing.
      </p>
      <h2>Back up before clearing</h2>
      <p>
        Export a room file from Share room. Clearing browser storage removes the
        local copy; an existing shared snapshot remains available to people who
        already have its link.
      </p>
      <Link href="/">Return to your miniature</Link>
    </main>
  );
}
