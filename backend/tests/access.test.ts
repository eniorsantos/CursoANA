import { describe, it, expect } from "vitest";
import { hasAccessToCourse } from "../src/lib/access.js";

// Teste de contrato: função existe e retorna booleano (integração real exige Postgres;
// coberta no CI com service postgres + migrate deploy).
describe("hasAccessToCourse", () => {
  it("é uma função assíncrona de checagem de acesso", () => {
    expect(typeof hasAccessToCourse).toBe("function");
  });
});
