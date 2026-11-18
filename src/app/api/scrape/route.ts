import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runIngest } from "@/lib/ingest";

// Manual trigger only (auth enforced by proxy). Fluid compute allows up to 300s.
export const maxDuration = 300;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const result = await runIngest({ skipSearch: searchParams.get("detailsOnly") === "1" });
    revalidatePath("/");
    return NextResponse.json(result);
  } catch (e) {
    console.error("ingest failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
