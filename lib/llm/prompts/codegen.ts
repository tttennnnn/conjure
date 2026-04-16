type Provider = "openrouter" | "anthropic";

// Delimiter-based instructions for OpenRouter models
const DELIMITER_INSTRUCTIONS = `
Output three Terraform files using these delimiters:

<<<MAIN_TF>>>
<contents of main.tf>
<<<END_MAIN_TF>>>

<<<VARIABLES_TF>>>
<contents of variables.tf>
<<<END_VARIABLES_TF>>>

<<<OUTPUTS_TF>>>
<contents of outputs.tf>
<<<END_OUTPUTS_TF>>>

RULES:
- Always output all three files, even if variables.tf or outputs.tf are minimal
- main.tf: provider block + all resource blocks derived from the config nodes
- variables.tf: variable declarations for configurable values — every variable MUST have a default value derived from the config YAML (the code will run with "terraform plan" with no -var flags)
- outputs.tf: useful output values (endpoint URLs, ARNs, IDs)
- Use the node IDs from the config as Terraform resource name suffixes (e.g. resource "aws_lb" "alb_main")
- Map networking.sg_inbound to security group ingress rules between resources
- Include a terraform {} block with required_providers
- Include exactly ONE provider block in main.tf — never duplicate provider configurations across files
- Do not use modules — output flat HCL only`;

// Tool definition for Anthropic structured output
export const CODEGEN_TOOL = {
  name: "generate_terraform",
  description:
    "Generate Terraform HCL files from the provided Mermaid diagram and configuration YAML.",
  input_schema: {
    type: "object" as const,
    properties: {
      mainTf: {
        type: "string",
        description:
          "Contents of main.tf: terraform block, exactly one provider block, and all resource definitions. Never put provider blocks in other files.",
      },
      variablesTf: {
        type: "string",
        description:
          "Contents of variables.tf: variable declarations only, each with a default value. No provider or resource blocks.",
      },
      outputsTf: {
        type: "string",
        description:
          "Contents of outputs.tf: output value declarations only. No provider or resource blocks.",
      },
    },
    required: ["mainTf", "variablesTf", "outputsTf"] as string[],
  },
};

export function buildCodegenSystemPrompt(
  mermaidCode: string,
  configYaml: string,
  targetEnv: string,
  iacTool: string,
  provider: Provider,
): string {
  const formatInstructions =
    provider === "anthropic"
      ? `Use the generate_terraform tool to return all three files. Always populate all three fields.`
      : DELIMITER_INSTRUCTIONS;

  const providerRules: string[] = [];

  if (targetEnv.toLowerCase() === "gcp") {
    providerRules.push(
      `GCP PROJECT ID: Always use var.project_id for the project argument in every GCP resource and data source. Declare it in variables.tf as: variable "project_id" { type = string; default = "" }. Never hardcode a project ID string.`,
    );
  }

  if (targetEnv.toLowerCase() === "aws") {
    providerRules.push(
      `AWS ACCOUNT ID: Never hardcode an AWS account ID. Whenever an account ID is needed (e.g. in ARNs, IAM policy documents, trust relationships), declare data "aws_caller_identity" "current" {} in main.tf and reference data.aws_caller_identity.current.account_id.`,
    );
  }

  // Both AWS and GCP: region comes from the deploy configuration, not the diagram.
  // Use var.region everywhere — provider block and any resource/data source that accepts a region or location argument.
  // Declare: variable "region" { type = string; default = "" }
  providerRules.push(
    `REGION: Always use var.region for the region (or location) argument in the provider block and in every resource or data source that accepts one. Declare it in variables.tf as: variable "region" { type = string; default = "" }. Never hardcode a region string.`,
  );

  const parts = [
    `You are a Terraform code generator. Given a Mermaid topology diagram and a configuration YAML, generate production-quality Terraform HCL.`,
    `Target environment: ${targetEnv.toUpperCase()}`,
    `IaC tool: ${iacTool}`,
    ...providerRules,
    formatInstructions,
    `DIAGRAM:\n<<<MERMAID>>>\n${mermaidCode}\n<<<END_MERMAID>>>`,
    `CONFIG:\n<<<CONFIG>>>\n${configYaml}\n<<<END_CONFIG>>>`,
  ];

  return parts.join("\n\n");
}
