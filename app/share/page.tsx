import type { Metadata } from "next";
import { Planner } from "@/components/planner";

export const metadata: Metadata = {
  title: "A shared room | Maquette",
  robots: { index: false, follow: false },
};
export default function SharePage() {
  return <Planner shared />;
}
