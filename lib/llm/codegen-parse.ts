import { parse as parseYaml } from "yaml";
import type { IacFiles } from "./codegen";

export interface CodegenValidationResult {
  valid: boolean;
  errors: string[];
}

function extractNodeIds(configYaml: string): string[] | null {
  if (!configYaml.trim()) return [];
  try {
    const parsed = parseYaml(configYaml);
    if (typeof parsed !== "object" || parsed === null) return [];
    const nodes = (parsed as Record<string, unknown>)["nodes"];
    if (typeof nodes !== "object" || nodes === null) return [];
    return Object.keys(nodes as Record<string, unknown>);
  } catch {
    return null;
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

  // Check 2: Provider block — exactly one
  const providerMatches = files.mainTf.match(/\bprovider\s+"/g);
  if (!providerMatches) {
    errors.push("mainTf is missing a provider block");
  } else if (providerMatches.length > 1) {
    errors.push("mainTf has duplicate provider blocks — include exactly one provider configuration");
  }

  // Check 2b: No provider blocks in variables.tf or outputs.tf
  if (files.variablesTf.includes('provider "')) {
    errors.push("variables.tf must not contain a provider block — only main.tf should");
  }
  if (files.outputsTf.includes('provider "')) {
    errors.push("outputs.tf must not contain a provider block — only main.tf should");
  }

  // Check 3: All variables must have defaults (no -var flags are passed at plan time)
  const varWithoutDefault = files.variablesTf.match(
    /variable\s+"[^"]+"\s*\{[^}]*\}/g,
  );
  if (varWithoutDefault) {
    for (const block of varWithoutDefault) {
      if (!block.includes("default")) {
        const nameMatch = block.match(/variable\s+"([^"]+)"/);
        const name = nameMatch ? nameMatch[1] : "unknown";
        errors.push(`variable "${name}" in variables.tf is missing a default value — all variables must have defaults`);
      }
    }
  }

  // Check 4: Node coverage
  const nodeIds = extractNodeIds(configYaml);
  if (nodeIds === null) {
    errors.push("configYaml could not be parsed — unable to verify node coverage");
  } else {
    for (const id of nodeIds) {
      // Substring search is intentional — full HCL parsing is overkill here.
      // Catches the common LLM failure of omitting a node entirely.
      if (!files.mainTf.includes(`"${id}"`)) {
        errors.push(`mainTf is missing a resource for node "${id}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
