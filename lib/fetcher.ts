export interface Article {
  id?: string;
  headline: string;
  summary: string;
  source: string;
  source_url: string;
  category: string;
  sentiment: "positiv" | "nøytral" | "negativ";
  read_time: number;
  fetched_at?: string;
}

export async function fetchNewsFromAnthropic(): Promise<Article[]> {
  const today = new Date().toLocaleDateString("no-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const systemPrompt = `Du er en norsk eiendomsnyhetsredaktør. Søk etter dagens eiendomsnyheter og returner et JSON-array.

REGLER:
1. Hent nyheter fra eiendomswatch.no og estatenyheter.no – disse er alltid relevante.
2. Fra e24.no, dn.no og finansavisen.no: hent KUN artikler om eiendom, boligmarked, næringseiendom, transaksjoner, boligrenter, eller bygg og anlegg. Ignorer alt annet.
3. Returner KUN et rent JSON-array. Ingen markdown, ingen forklaring, ingen backticks.
4. Dato i dag: ${today}

JSON-format:
[
  {
    "headline": "Overskrift på norsk",
    "summary": "2-3 setninger med konkrete tall og navn der tilgjengelig.",
    "source": "eiendomswatch.no | estatenyheter.no | E24 | DN | Finansavisen",
    "source_url": "https://faktisk-url.no/artikkel",
    "category": "Boligmarked|Næringseiendom|Transaksjoner|Analyse|Renter",
    "sentiment": "positiv|nøytral|negativ",
    "read_time": 2
  }
]

Hent minst 10 artikler totalt.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [
        {
          role: "user",
          content: `Søk etter dagens eiendomsnyheter (${today}) fra:
- https://eiendomswatch.no/
- https://www.estatenyheter.no/
- https://e24.no/ (kun eiendom/bygg/bolig)
- https://www.dn.no/ (kun eiendom/bygg/bolig)
- https://www.finansavisen.no/ (kun eiendom/bygg/bolig)

Returner kun JSON-array.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API feil: ${response.status} – ${err}`);
  }

  const data = await response.json();

  const allText = (data.content || [])
    .map((block: { type: string; text?: string }) =>
      block.type === "text" ? block.text : ""
    )
    .filter(Boolean)
    .join("\n");

  const jsonMatch = allText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Ingen JSON funnet i Anthropic-respons");

  const articles: Article[] = JSON.parse(jsonMatch[0]);
  return articles;
}
