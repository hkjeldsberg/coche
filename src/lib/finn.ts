import type { FinnSearchDoc } from "./parse";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const SEARCH_API = "https://www.finn.no/mobility/search/api/search/SEARCH_ID_CAR_USED";

// Finn variant codes: Volvo XC40 / Volvo EX40. fuel=4 = El.
// Ingest wide (slider maxima); UI narrows.
export const SEARCH_PARAMS: [string, string][] = [
  ["variant", "1.818.2000437"],
  ["variant", "1.818.2000669"],
  ["fuel", "4"],
  ["sales_form", "1"], // Bruktbil til salgs — excludes leasing (monthly price) and auctions
  ["year_from", "2024"],
  ["price_to", "700000"],
  ["mileage_to", "120000"],
  ["sort", "PUBLISHED_DESC"],
];

async function get(url: string, accept: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "nb-NO,nb;q=0.9" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Finn ${res.status} for ${url}`);
  return res;
}

type SearchResponse = {
  docs: FinnSearchDoc[];
  metadata: { paging: { current: number; last: number }; result_size: { match_count: number } };
};

/** All search result docs across pages. Throws if any page fails (so we never mark ads inactive on partial data). */
export async function fetchAllSearchDocs(maxPages = 20): Promise<FinnSearchDoc[]> {
  const docs: FinnSearchDoc[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const qs = new URLSearchParams([...SEARCH_PARAMS, ["page", String(page)]]);
    const data = (await (await get(`${SEARCH_API}?${qs}`, "application/json")).json()) as SearchResponse;
    docs.push(...data.docs.filter((d) => d.id));
    if (page >= data.metadata.paging.last) break;
  }
  // Dedupe (Finn can repeat an ad across page boundaries when new ads arrive mid-run).
  return [...new Map(docs.map((d) => [String(d.id), d])).values()];
}

export function adUrl(id: string): string {
  return `https://www.finn.no/mobility/item/${id}`;
}

export async function fetchAdHtml(id: string): Promise<string> {
  return (await get(adUrl(id), "text/html")).text();
}
