import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { site } from "@/lib/site";

export async function POST() {
  await destroySession();
  return NextResponse.redirect(new URL("/", site.url), { status: 303 });
}
