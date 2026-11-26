import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "About the fit check | Maquette" };
export default function AboutPage() {
  return (
    <main className="document-page">
      <Link href="/" className="wordmark">
        maquette
      </Link>
      <h1>Beautiful is not enough. It has to fit.</h1>
      <p>
        Maquette uses your confirmed room measurements and exact furniture
        sizes. Parametric models have approximate shapes, but their outer
        dimensions are real. The plan and miniature read the same centimeter
        geometry.
      </p>
      <h2>What the solver protects</h2>
      <p>
        Walls, furniture collisions, door swings, tall pieces blocking windows,
        fixed features and category use zones. A conservative grid checks
        connected main walkways. It can reject an arrangement that a finer
        search might find. It will not call a blocked route clear.
      </p>
      <h2>Defaults, not a building inspection</h2>
      <p>
        The main walkway starts at 36 inches, informed by the 2010 ADA
        accessible-route standard. Bedside access starts at 24 inches, desk and
        dresser access at 36 inches, seating access at 18 inches. These are
        editable planning guidelines, not accessibility or code-compliance
        certification.
      </p>
      <p>
        <a
          href="https://www.access-board.gov/ada/chapter/ch04/"
          target="_blank"
          rel="noreferrer"
        >
          ADA route guidance
        </a>{" "}
        and{" "}
        <a
          href="https://roomsketch3d.com/help/dimensions/clearance-around-furniture"
          target="_blank"
          rel="noreferrer"
        >
          published furniture-spacing guidance
        </a>
        .
      </p>
      <h2>Check before moving day</h2>
      <p>
        Uploaded plans produce low-confidence boundary and opening proposals.
        Confirm each dimension with the source plan or a tape measure.
        Multi-room documents should be cropped to one room. No claim of measured
        accuracy is made without that check.
      </p>
      <h2>What is not here yet</h2>
      <p>
        LiDAR capture, photo reconstruction, branded catalogs, generated product
        meshes, path-traced stills and live collaboration. The walk-in uses the
        same real-time model; it is not a photograph.
      </p>
      <Link href="/">Return to your room</Link>
    </main>
  );
}
