ALTER TABLE public.cue_skins
  ADD COLUMN IF NOT EXISTS image_url text;

UPDATE public.cue_skins
SET image_url = CASE slug
  WHEN 'starter'  THEN '/game/assets/img/cues/starter.png'
  WHEN 'oak'      THEN '/game/assets/img/cues/oak.png'
  WHEN 'crimson'  THEN '/game/assets/img/cues/crimson.png'
  WHEN 'emerald'  THEN '/game/assets/img/cues/emerald.png'
  WHEN 'obsidian' THEN '/game/assets/img/cues/obsidian.png'
  WHEN 'royal'    THEN '/game/assets/img/cues/royal.png'
  ELSE image_url
END
WHERE slug IN ('starter', 'oak', 'crimson', 'emerald', 'obsidian', 'royal');
