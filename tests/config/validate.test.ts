import { describe, it, expect } from "vitest";
import { validateConfigYaml, extractConfigNodeIds } from "@/lib/config/validate";

describe("validateConfigYaml", () => {
  it("validates correct config", () => {
    const yaml = `nodes:
  db:
    resource: aws_db_instance
    config:
      engine: postgres
  web:
    resource: aws_instance`;
    const result = validateConfigYaml(yaml);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.nodeIds).toEqual(expect.arrayContaining(["db", "web"]));
  });

  it("rejects invalid YAML syntax", () => {
    const result = validateConfigYaml("{ invalid yaml: [}");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/YAML parse error/);
  });

  it("rejects missing nodes key", () => {
    const result = validateConfigYaml("resources:\n  db: {}");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/nodes/);
  });

  it("rejects array root", () => {
    const result = validateConfigYaml("- item1\n- item2");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/object/);
  });

  it("rejects nodes as array", () => {
    const result = validateConfigYaml("nodes:\n  - db");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/object/);
  });

  it("rejects node missing resource field", () => {
    const yaml = `nodes:
  db:
    config:
      engine: postgres`;
    const result = validateConfigYaml(yaml);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/resource/);
  });

  it("rejects banned key __proto__", () => {
    const yaml = `nodes:
  __proto__:
    resource: aws_instance`;
    const result = validateConfigYaml(yaml);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Banned key/);
  });

  it("rejects banned key constructor", () => {
    const yaml = `nodes:
  constructor:
    resource: aws_instance`;
    const result = validateConfigYaml(yaml);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Banned key/);
  });

  it("rejects node that is not an object", () => {
    const yaml = `nodes:
  db: just_a_string`;
    const result = validateConfigYaml(yaml);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/must be an object/);
  });

  it("reports multiple errors", () => {
    const yaml = `nodes:
  good:
    resource: aws_instance
  bad_no_resource:
    config: {}
  also_bad:
    stuff: true`;
    const result = validateConfigYaml(yaml);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
  });
});

describe("extractConfigNodeIds", () => {
  it("extracts node IDs from valid YAML", () => {
    const yaml = `nodes:
  alb:
    resource: aws_lb
  rds:
    resource: aws_db_instance`;
    expect(extractConfigNodeIds(yaml)).toEqual(["alb", "rds"]);
  });

  it("returns empty array for invalid YAML", () => {
    expect(extractConfigNodeIds("{ bad yaml")).toEqual([]);
  });

  it("returns empty array for YAML without nodes", () => {
    expect(extractConfigNodeIds("other: value")).toEqual([]);
  });
});
