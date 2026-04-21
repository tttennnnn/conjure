/**
 * Shared diagram style rules — single source of truth for both chat and import prompts.
 * Any rule that affects how the Mermaid diagram or config YAML looks must live here
 * so that prompt-generated and import-generated diagrams are visually identical.
 */

export const STYLE_CLASSES = `Each node MUST use both the correct Mermaid shape AND a :::className for its category. Use standard cloud architecture symbols:

  cls_compute  (rectangle)    — id[Label]:::cls_compute
    aws_instance, aws_autoscaling_group, aws_lambda_function, aws_ecs_service, aws_eks_cluster, google_compute_instance, google_cloud_run_service, google_cloudfunctions_function
  cls_database (cylinder)     — id[(Label)]:::cls_database
    aws_db_instance, aws_rds_cluster, aws_dynamodb_table, google_sql_database_instance, google_spanner_instance, google_firestore_database
  cls_cache    (cylinder)     — id[(Label)]:::cls_cache
    aws_elasticache_cluster, aws_elasticache_replication_group, google_redis_instance
  cls_network  (hexagon)      — id{{Label}}:::cls_network
    aws_lb, aws_alb, aws_vpc, aws_subnet, aws_api_gateway_rest_api, google_compute_network, google_compute_global_forwarding_rule
  cls_storage  (cylinder)     — id[(Label)]:::cls_storage
    aws_s3_bucket, aws_efs_file_system, google_storage_bucket
  cls_cdn      (rounded rect) — id(Label):::cls_cdn
    aws_cloudfront_distribution
  cls_queue    (parallelogram) — id[/Label/]:::cls_queue
    aws_sqs_queue, aws_sns_topic, google_pubsub_topic

  Virtual/edge nodes (internet, users, client, external) use stadium shape with NO class: id([Label])`;

export const NODE_LABEL_RULES = `NODE LABEL FORMAT (critical — labels must look the same whether generated from a prompt or imported from .tf):
- Use short, human-readable labels that describe WHAT the component is
- Good: alb_main{{Application Load Balancer}}:::cls_network
- Good: rds_primary[(PostgreSQL RDS)]:::cls_database
- Good: api_server[API Server]:::cls_compute
- Good: redis_cache[(Redis Cache)]:::cls_cache
- Good: sqs_queue[/Message Queue/]:::cls_queue
- Good: internet([Internet / Users])
- Bad:  app[aws_instance.app\\nt3.micro · Amazon Linux 2023]:::cls_compute
- Bad:  postgres[aws_db_instance.postgres\\nPostgreSQL 16 · db.t3.micro]:::cls_database
- Bad:  rds_primary[PostgreSQL RDS]:::cls_database  (wrong — database must use cylinder shape [(Label)])
- Do NOT embed Terraform resource type paths, instance types, engine versions, or any config details in the label — those belong in the config YAML only`;

export const EDGE_RULES = `- Use plain edges (-->) — do NOT put port numbers, protocols, or labels on edges (e.g. -->|HTTP :80| is wrong, use --> instead)
- Port numbers and protocols belong in the config YAML networking section, not on the diagram`;

export const TOPOLOGY_RULES = `- Include only significant infrastructure resources as nodes (servers, databases, load balancers, caches, storage, queues, CDNs)
- Omit low-level plumbing like subnet groups, route tables, route table associations, IAM policies, IAM roles, and security groups — these are captured in the config YAML networking section instead
- You MAY add a virtual edge node (internet([Internet / Users])) if there is a public-facing load balancer or gateway`;

export const CONFIG_SCHEMA = `CONFIG SCHEMA:
nodes:
  <node_id>:
    resource: <string>          # Terraform resource type (e.g. aws_lb, aws_db_instance)
    config:                     # resource-specific configuration
      <key>: <value>
    networking:                 # optional
      subnet: public|private
      port: <number>
      sg_inbound: [<node_ids>]  # list of node IDs allowed inbound

- Do NOT include region or location in the config. Region is a deploy-time setting chosen by the user in the Deploy tab and applies to all resources.`;
