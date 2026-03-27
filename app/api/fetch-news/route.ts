import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchNewsFromAnthropic } from "@/lib/fetcher";

export async function GET(_req: NextRequest) {
  try {
    console.log("🏠 Starter nyhetshenting...");
    const articles = await fetchNewsFromAnthropic();
    console.log(`✅ Hentet ${articles.length} artikler`);

    const { error } = await supabaseAdmin.from("articles").upsert(
      articles.map((a) => ({
        ...a,
        fetched_at: new Date().toISOString(),
      })),
      { onConflict: "headline", ignoreDuplicates: true }
    );

    if (error) throw error;

    await supabaseAdmin
      .from("articles")
      .delete()
      .lt("fetched_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    return NextResponse.json({
      success: true,
      count: articles.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Feil:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
