import { assertUnreachable } from "@/lib/assertUnreachable";

describe("assertUnreachable", () => {
  it("throws with a generated message when none is provided", () => {
    expect(() => assertUnreachable("unexpected" as never)).toThrow(
      "Unexpected value: unexpected",
    );
  });

  it("throws with the provided message", () => {
    expect(() => assertUnreachable("unexpected" as never, "Custom message")).toThrow(
      "Custom message",
    );
  });
});
