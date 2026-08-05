import { NextResponse } from "next/server";
import { getPatchUpdates } from "@/lib/data/patches";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId") || "1193207365906997379";

  try {
    const patches = await getPatchUpdates(channelId);
    revalidatePath("/play");
    revalidatePath("/admin/play");
    revalidatePath("/admin/pages");
    return NextResponse.json({ ok: true, channelId, patches });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch channel patches";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
