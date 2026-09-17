// Skills every installation path equips, even when the user picks a profile,
// adds one skill directly, or browses the catalog by hand.
//
// `orient` and `suggest` are runtime always-on. `bro` is installed by default
// but remains conditionally loaded: its description routes human-language asks
// without paying for its body on unrelated turns.
//
// `ftd` joined in 2.0.1 by the same criterion as `suggest`: the always-on decisor
// routes ordinary work to `../ftd/SKILL.md`, so a harness without it has a default
// lane that points at nothing. Membership of every profile was not enough — a
// declaration written before the skill existed never gains it (see `syncInstalled`).
export const DEFAULT_SKILL_FLOOR = Object.freeze(['orient', 'suggest', 'bro', 'ftd']);

export function withDefaultSkillFloor(skillIds = []) {
  return [...new Set([...DEFAULT_SKILL_FLOOR, ...skillIds])];
}
