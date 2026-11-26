import { Planner } from "@/components/planner";
import { hasDatabase } from "@/lib/server/db";

export default function Page() {
  return <Planner cloudStorage={hasDatabase} />;
}
