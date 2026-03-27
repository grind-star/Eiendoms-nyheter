import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchNewsFromAnthropic } from "@/lib/fetcher";

// Vercel Cron kaller denne med Authorization-header
export async function GET(req: NextRequest) {
  // Sikkerhet: verifiser at det er Vercel Cron (eller manuell trigger med secret)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("🏠 Starter nyhetshenting...");
    const articles = await fetchNewsFromAnthropic();
    console.log(`✅ Hentet ${articles.length} artikler`);

    // Lagre i Supabase – insert nye, ignorer duplikater (basert på headline)
    const { error } = await supabaseAdmin.from("articles").upsert(
      articles.map((a) => ({
        ...a,
        fetched_at: new Date().toISOString(),
      })),
      { onConflict: "headline", ignoreDuplicates: true }
    );

    if (error) throw error;

    // Slett artikler eldre enn 7 dager for å holde databasen ryddig
    await supabaseAdmin
      .from("articles")
      .delete()
      .lt(
        "fetched_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      );

    return NextResponse.json({
      success: true,
      count: articles.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Feil ved nyhetshenting:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
