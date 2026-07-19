
import { NextRequest, NextResponse } from "next/server";
import { StatCardData } from "@/components/types/stats.types";

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get("range") ?? "today";

  const stats: StatCardData[] = [
    { id: "web-views", label: "Web Views", value: 658000, change: 3.05, format: "compact" },
    { id: "unique-visitors", label: "Unique Visitors", value: 246000, change: -8.36, format: "compact" },
    { id: "new-users", label: "New Users", value: 1352, change: 2.65, format: "number" },
    { id: "page-views", label: "Page view", value: 438, change: -0.37, format: "number" },
    { id: "active-users", label: "Active Users", value: 294000, change: 5.12, format: "compact" },
  ];

  return NextResponse.json(stats);
}