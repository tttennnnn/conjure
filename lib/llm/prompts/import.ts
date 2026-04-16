import {
  STYLE_CLASSES,
  NODE_LABEL_RULES,
  EDGE_RULES,
  TOPOLOGY_RULES,
  CONFIG_SCHEMA,
} from "./shared";

type Provider = "openrouter" | "anthropic";

const DIAGRAM_RULES = `
- Mermaid MUST start with "graph TD" or "flowchart TD"
- Config MUST be valid YAML matching the schema below
- Every node ID in the Mermaid diagram MUST have a corresponding entry in the config, and vice versa
- Node IDs use snake_case and should match Terraform resource names where possible (e.g. resource "aws_lb" "alb_main" → node ID: alb_main)
${EDGE_RULES}
${TOPOLOGY_RULES}
- Infer connections (edges) from: security group inbound rules, IAM role references, depends_on, and common architectural patterns
- ${STYLE_CLASSES}
- Always output the FULL diagram and FULL config

${NODE_LABEL_RULES}`;

const DELIMITER_INSTRUCTIONS = `
Parse the Terraform HCL and output the infrastructure as a Mermaid diagram and a configuration YAML.

Wrap the COMPLETE Mermaid code in <<<MERMAID>>> and <<<END_MERMAID>>> delimiters.
Wrap the COMPLETE config YAML in <<<CONFIG>>> and <<<END_CONFIG>>> delimiters.
${DIAGRAM_RULES}`;

const TOOL_INSTRUCTIONS = `
Parse the Terraform HCL and return the infrastructure as a Mermaid diagram and configuration YAML using the import_infrastructure tool.

- Always populate both mermaidCode and configYaml fields
${DIAGRAM_RULES}`;

export function buildImportSystemPrompt(
  targetEnv: string,
  iacTool: string,
  provider: Provider,
): string {
  const formatInstructions =
    provider === "anthropic" ? TOOL_INSTRUCTIONS : DELIMITER_INSTRUCTIONS;

  return [
    `You are a cloud infrastructure analyst. Given Terraform HCL files, reverse-engineer the infrastructure into a Mermaid topology diagram and a configuration YAML.`,
    `Target environment: ${targetEnv.toUpperCase()}`,
    `IaC tool: ${iacTool}`,
    formatInstructions,
    CONFIG_SCHEMA,
  ].join("\n\n");
}

// Anthropic tool definition for structured import output
export const IMPORT_TOOL = {
  name: "import_infrastructure",
  description:
    "Output the reverse-engineered infrastructure diagram and configuration from Terraform HCL.",
  input_schema: {
    type: "object" as const,
    properties: {
      mermaidCode: {
        type: "string",
        description:
          "The complete Mermaid diagram code starting with 'graph TD'. Use short human-readable node labels (e.g. 'Application Server', 'PostgreSQL RDS') — never embed instance types or config details in labels. Include :::className suffixes on infrastructure nodes.",
      },
      configYaml: {
        type: "string",
        description:
          "The complete config YAML with all nodes. Must include a 'resource' field for each node.",
      },
    },
    required: ["mermaidCode", "configYaml"] as string[],
  },
};
