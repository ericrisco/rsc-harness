// Skills every installation path equips, even when the user picks a profile,
// adds one skill directly, or browses the catalog by hand.
//
// `orient` and `suggest` are runtime always-on. `bro` is installed by default
// but remains conditionally loaded: its description routes human-language asks
// without paying for its body on unrelated turns.
export const DEFAULT_SKILL_FLOOR = Object.freeze(['orient', 'suggest', 'bro']);

export function withDefaultSkillFloor(skillIds = []) {
  return [...new Set([...DEFAULT_SKILL_FLOOR, ...skillIds])];
}
