// Shared mutable state across feature modules. Kept as a single plain object
// (rather than separate `let` exports) so every module sees live updates —
// ES module bindings for reassigned primitives don't propagate the way
// object property mutations do.
export const state = {
  currentUser: null,
  selectedLilbro: null,
  allBigBros: [],
  selectedBigbro: null,
};
