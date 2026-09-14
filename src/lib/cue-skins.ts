import { supabase } from "@/integrations/supabase/client";
import { LOCAL_TEST_MODE, getLocalCueSlug } from "@/lib/local-test-mode";

export const CUE_SKIN_SLUGS = [
  "starter",
  "oak",
  "crimson",
  "emerald",
  "obsidian",
  "royal",
] as const;

export type CueSkinSlug = (typeof CUE_SKIN_SLUGS)[number];
export type ArenaTheme = "ruby" | "london" | "vegas";

type SkinAsset = {
  slug: string;
  image_url?: string | null;
};

type EquippedCueRow = {
  cue_skins: { slug: string } | { slug: string }[] | null;
};

export function normalizeCueSkinSlug(value: unknown): CueSkinSlug {
  return CUE_SKIN_SLUGS.includes(value as CueSkinSlug) ? (value as CueSkinSlug) : "starter";
}

export function cueAssetUrl(skin: SkinAsset): string {
  return skin.image_url?.trim() || `/game/assets/img/cues/${normalizeCueSkinSlug(skin.slug)}.png`;
}

export function cueGameUrl(
  slug: CueSkinSlug,
  botSlug?: CueSkinSlug,
  theme: ArenaTheme = "ruby",
): string {
  const params = new URLSearchParams({ cue: slug, embedded: "1" });
  if (botSlug) params.set("botCue", botSlug);
  params.set("theme", theme);
  return `/game/index.html?${params.toString()}`;
}

export async function getEquippedCueSlug(userId: string): Promise<CueSkinSlug> {
  if (LOCAL_TEST_MODE) return normalizeCueSkinSlug(getLocalCueSlug());
  const { data, error } = await supabase
    .from("user_cues")
    .select("cue_skins(slug)")
    .eq("user_id", userId)
    .eq("equipped", true)
    .maybeSingle();

  if (error || !data) return "starter";

  const related = (data as unknown as EquippedCueRow).cue_skins;
  const slug = Array.isArray(related) ? related[0]?.slug : related?.slug;
  return normalizeCueSkinSlug(slug);
}
