// Skills every installation path equips, even when the user picks a profile,
// adds one skill directly, or browses the catalog by hand.
//
// `orient` and `suggest` are runtime always-on. `unslop` is installed by default
// but remains conditionally loaded: its description routes "rewrite this for
// other people" asks without paying for its body on unrelated turns. It took the
// place of `bro`, which was retired into it (see retired-skills.js).
//
// `ftd` joined in 2.0.1 by the same criterion as `suggest`: the always-on decisor
// routes ordinary work to `../ftd/SKILL.md`, so a harness without it has a default
// lane that points at nothing. Membership of every profile was not enough — a
// declaration written before the skill existed never gains it (see `syncInstalled`).
//
// `connect-tool` joined in 3.0.13 (issue #303): rsc ships no ready-made connections, so "connect my
// Holded" is answered by a method, not a list, and that method has to be there the first time the
// user asks, in any kind of project. Like `unslop`, only its description is paid for on other turns.
export const DEFAULT_SKILL_FLOOR = Object.freeze(['orient', 'suggest', 'unslop', 'ftd', 'connect-tool']);

export function withDefaultSkillFloor(skillIds = []) {
  return [...new Set([...DEFAULT_SKILL_FLOOR, ...skillIds])];
}
