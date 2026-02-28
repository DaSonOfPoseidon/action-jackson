import { describe, it, expect } from "vitest";
import { validateEmail, validatePhone, validateName, validateRequired } from "@/lib/validation";

describe("validateEmail", () => {
  it("returns null for valid email", () => {
    expect(validateEmail("test@gmail.com")).toBeNull();
  });

  it("rejects empty email", () => {
    expect(validateEmail("")).toBe("Email is required");
  });

  it("rejects invalid format", () => {
    expect(validateEmail("not-an-email")).toBe("Please enter a valid email address");
  });

  it("rejects disposable domains", () => {
    expect(validateEmail("test@mailinator.com")).toBe(
      "Please use a non-disposable email address"
    );
  });

  it("rejects other disposable domains", () => {
    expect(validateEmail("test@guerrillamail.com")).toBe(
      "Please use a non-disposable email address"
    );
  });
});

describe("validatePhone", () => {
  it("returns null for empty (optional)", () => {
    expect(validatePhone("")).toBeNull();
  });

  it("returns null for valid phone", () => {
    expect(validatePhone("(555) 123-4567")).toBeNull();
  });

  it("rejects invalid phone", () => {
    expect(validatePhone("abc")).not.toBeNull();
  });
});

describe("validateName", () => {
  it("returns null for valid name", () => {
    expect(validateName("John Doe")).toBeNull();
  });

  it("rejects empty name", () => {
    expect(validateName("")).toBe("Name is required");
  });

  it("rejects short name", () => {
    expect(validateName("J")).toBe("Name must be at least 2 characters");
  });

  it("rejects names with special characters", () => {
    expect(validateName("Test<script>")).not.toBeNull();
  });

  it("accepts names with apostrophes and hyphens", () => {
    expect(validateName("O'Brien-Smith")).toBeNull();
  });
});

describe("validateRequired", () => {
  it("returns null for non-empty string", () => {
    expect(validateRequired("value", "Field")).toBeNull();
  });

  it("returns error for empty string", () => {
    expect(validateRequired("", "Field")).toBe("Field is required");
  });

  it("returns null for non-empty array", () => {
    expect(validateRequired(["a"], "service")).toBeNull();
  });

  it("returns error for empty array", () => {
    expect(validateRequired([], "service")).toBe("Please select at least one service");
  });
});
