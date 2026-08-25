// Compile-time-only type equality check. Used to pin a zod schema's inferred
// type against a hand-written interface so `tsc` fails the build the moment
// they drift apart, instead of the mismatch only surfacing at runtime.
//
// Usage: `type _Check = AssertExact<z.infer<typeof Schema>, SomeInterface>;`
// (the underscore-prefixed type is never used at runtime — its only job is
// to fail to compile if the two shapes disagree).
export type AssertExact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : never;
