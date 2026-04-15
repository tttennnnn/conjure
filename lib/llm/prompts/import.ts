type Provider = "openrouter" | "anthropic";

const DELIMITER_INSTRUCTIONS = `
Parse the Terraform HCL and output the infrastructure as a Mermaid diagram and a configuration YAML.

Wrap the COMPLETE Mermaid code in <<<MERMAID>>> and <<<END_MERMAID>>> delimiters.
Wrap the COMPLETE config YAML in <<<CONFIG>>> and <<<END_CONFIG>>> delimiters.

RULES:
- Mermaid MUST start with "graph TD" or "flowchart TD"
- Config MUST be valid YAML matching the schema below
- Every node ID in the Mermaid diagram MUST have a corresponding entry in the config, and vice versa
- Node IDs use snake_case and should match Terraform resource names where possible (e.g. resource "aws_lb" "alb_main" → node ID: alb_main)
- Include ALL infrastructure resources as nodes — omit provider config, variables, and outputs
- Infer connections (edges) from: security group inbound rules, IAM role references, depends_on, and common architectural patterns
- Append a style class to each node using :::className based on resource category:
  :::cls_compute  — aws_instance, aws_autoscaling_group, aws_lambda_function, aws_ecs_service, aws_eks_cluster, google_compute_instance, google_cloud_run_service
  :::cls_database — aws_db_instance, aws_rds_cluster, aws_dynamodb_table, google_sql_database_instance
  :::cls_cache    — aws_elasticache_cluster, aws_elasticache_replication_group, google_redis_instance
  :::cls_network  — aws_lb, aws_alb, aws_vpc, aws_subnet, aws_api_gateway_rest_api, google_compute_network, google_compute_global_forwarding_rule
  :::cls_storage  — aws_s3_bucket, aws_efs_file_system, google_storage_bucket
  :::cls_cdn      — aws_cloudfront_distribution
  :::cls_queue    — aws_sqs_queue, aws_sns_topic, google_pubsub_topic
- You MAY add a virtual edge node (internet[Internet / Users]) if there is a public-facing load balancer or gateway
- Always output the FULL diagram and FULL config`;

const TOOL_INSTRUCTIONS = `
Parse the Terraform HCL and return the infrastructure as a Mermaid diagram and configuration YAML using the import_infrastructure tool.

RULES:
- Always populate both mermaidCode and configYaml fields
- Mermaid must start with "graph TD"
- Config must match the schema below
- Every node ID in the Mermaid diagram MUST match the config, and vice versa
- Node IDs use snake_case matching Terraform resource names where possible
- Include ALL infrastructure resources — omit provider config, variables, and outputs
- Infer connections from security group rules, IAM references, depends_on, and common patterns
- Append :::className to each node based on resource category (cls_compute, cls_database, cls_cache, cls_network, cls_storage, cls_cdn, cls_queue)
- You MAY add a virtual internet[Internet / Users] node if there is a public-facing entry point`;

const CONFIG_SCHEMA = `
CONFIG SCHEMA:
nodes:
  <node_id>:
    resource: <string>          # Terraform resource type (e.g. aws_lb, aws_db_instance)
    config:                     # resource-specific configuration extracted from HCL
      <key>: <value>
    networking:                 # optional — infer from security groups and references
      subnet: public|private
      port: <number>
      sg_inbound: [<node_ids>]  # list of node IDs allowed inbound`;

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
          "The complete Mermaid diagram code starting with 'graph TD'. Include all infrastructure nodes with :::className suffixes.",
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
