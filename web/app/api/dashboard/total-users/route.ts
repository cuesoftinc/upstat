import { NextRequest, NextResponse } from "next/server";
import { TotalUsersResponse } from "@/components/types/totalUsers.types";

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get("range") ?? "today";

  const labels = ["Mon", "Tue", "Wed", "Thur", "Fri", "Sat", "Sun"];

  const points = labels.map((label, i) => ({
    label,
    current: Math.round(1000000 + i * 1800000 + Math.random() * 800000),
    previous: Math.round(1500000 + i * 1600000 + Math.random() * 600000),
  }));

  const response: TotalUsersResponse = {
    points,
    latest: { label: "Sat", value: points[5].current },
  };

  return NextResponse.json(response);
}