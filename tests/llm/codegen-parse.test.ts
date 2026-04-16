import { describe, it, expect } from "vitest";
import { validateCodegenOutput } from "@/lib/llm/codegen-parse";

const VALID_MAIN_TF = `
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.region
}

resource "aws_lb" "alb_main" {
  internal           = false
  load_balancer_type = "application"
}
`;

const VALID_CONFIG_YAML = `
nodes:
  alb_main:
    resource: aws_lb
    config:
      internal: false
`;

describe("validateCodegenOutput", () => {
  it("passes valid files with all nodes present", () => {
    const result = validateCodegenOutput(
      { mainTf: VALID_MAIN_TF, variablesTf: "", outputsTf: "" },
      VALID_CONFIG_YAML,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when mainTf is empty", () => {
    const result = validateCodegenOutput(
      { mainTf: "", variablesTf: "", outputsTf: "" },
      VALID_CONFIG_YAML,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/HCL/);
  });

  it("fails when mainTf is prose with no HCL keywords", () => {
    const result = validateCodegenOutput(
      { mainTf: "Here is your Terraform code. I will generate it now.", variablesTf: "", outputsTf: "" },
      VALID_CONFIG_YAML,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/HCL/);
  });

  it("fails when mainTf is missing a provider block", () => {
    const noProvider = VALID_MAIN_TF.replace('provider "aws"', "// removed");
    const result = validateCodegenOutput(
      { mainTf: noProvider, variablesTf: "", outputsTf: "" },
      VALID_CONFIG_YAML,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /provider/i.test(e))).toBe(true);
  });

  it("fails and names every config node missing from mainTf", () => {
    const configWithExtra = `
nodes:
  alb_main:
    resource: aws_lb
  rds_primary:
    resource: aws_db_instance
`;
    const result = validateCodegenOutput(
      { mainTf: VALID_MAIN_TF, variablesTf: "", outputsTf: "" },
      configWithExtra,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("rds_primary"))).toBe(true);
  });

  it("passes when configYaml has no nodes", () => {
    const result = validateCodegenOutput(
      { mainTf: VALID_MAIN_TF, variablesTf: "", outputsTf: "" },
      "nodes: {}",
    );
    expect(result.valid).toBe(true);
  });

  it("passes when variablesTf and outputsTf are empty", () => {
    const result = validateCodegenOutput(
      { mainTf: VALID_MAIN_TF, variablesTf: "", outputsTf: "" },
      VALID_CONFIG_YAML,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
