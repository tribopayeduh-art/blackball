
-- Add lore column for skin history
ALTER TABLE public.cue_skins ADD COLUMN IF NOT EXISTS lore text;

-- Set lower prices (10/20/30/40/50/60) and add history
UPDATE public.cue_skins SET price = 0,  lore = 'O primeiro taco de todo jogador. Simples, confiável e cheio de partidas memoráveis. Forjado em madeira comum, foi com este taco que muitos campeões deram suas primeiras tacadas.' WHERE slug = 'starter';
UPDATE public.cue_skins SET price = 10, lore = 'Esculpido a partir de carvalho centenário das florestas da Escócia. O Carvalho Clássico é conhecido por sua estabilidade e equilíbrio impecável — o taco preferido dos jogadores de pub há mais de 80 anos.' WHERE slug = 'oak';
UPDATE public.cue_skins SET price = 20, lore = 'Forjado em uma noite de tempestade em Macau. Diz a lenda que o Crimson Edge nunca perdeu uma partida final entre 1998 e 2003. Sua ponta vermelho-sangue intimida adversários antes mesmo da quebra.' WHERE slug = 'crimson';
UPDATE public.cue_skins SET price = 30, lore = 'Incrustado com pó de esmeralda da Colômbia. Pertenceu ao lendário "Verdão", campeão sul-americano por sete temporadas consecutivas. Cada tacada brilha levemente sob a luz da mesa.' WHERE slug = 'emerald';
UPDATE public.cue_skins SET price = 40, lore = 'Talhado em obsidiana vulcânica do Havaí. Pesado, frio ao toque e mortalmente preciso. Apenas mestres conseguem dominar seu equilíbrio — quem dominar, raramente erra uma caçapa.' WHERE slug = 'obsidian';
UPDATE public.cue_skins SET price = 60, lore = 'O Cetro Real foi originalmente um cetro cerimonial de uma dinastia esquecida. Banhado em ouro 24k e cravejado com fragmentos de rubi. Apenas três cópias existem no mundo — e nenhuma perdeu mais do que ganhou.' WHERE slug = 'royal';
