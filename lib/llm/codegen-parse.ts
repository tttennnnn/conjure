import { parse as parseYaml } from "yaml";
import type { IacFiles } from "./codegen";

export interface CodegenValidationResult {
  valid: boolean;
  errors: string[];
}

function extractNodeIds(configYaml: string): string[] {
  if (!configYaml.trim()) return [];
  try {
    const parsed = parseYaml(configYaml) as { nodes?: Record<string, unknown> };
    return Object.keys(parsed?.nodes ?? {});
  } catch {
    return [];
  }
}

export function validateCodegenOutput(
  files: IacFiles,
  configYaml: string,
): CodegenValidationResult {
  const errors: string[] = [];

  // Check 1: HCL presence — bail early if clearly not HCL
  const looksLikeHcl =
    files.mainTf.includes("terraform {") || files.mainTf.includes('resource "');
  if (!looksLikeHcl) {
    return {
      valid: false,
      errors: ["mainTf does not contain HCL (no terraform block or resource declarations found)"],
    };
  }

  // Check 2: Provider block
  if (!files.mainTf.includes('provider "')) {
    errors.push("mainTf is missing a provider block");
  }

  // Check 3: Node coverage
  const nodeIds = extractNodeIds(configYaml);
  for (const id of nodeIds) {
    if (!files.mainTf.includes(`"${id}"`)) {
      errors.push(`mainTf is missing a resource for node "${id}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}
