/**
 * Maps Terraform resource types to Mermaid node CSS class names.
 * Classes are applied via Mermaid's :::className syntax and styled in globals.css.
 */

export const RESOURCE_CLASS_MAP: Record<string, string> = {
  // Compute
  aws_instance: "cls_compute",
  aws_autoscaling_group: "cls_compute",
  aws_launch_template: "cls_compute",
  aws_lambda_function: "cls_compute",
  aws_ecs_cluster: "cls_compute",
  aws_ecs_service: "cls_compute",
  aws_ecs_task_definition: "cls_compute",
  aws_eks_cluster: "cls_compute",
  google_compute_instance: "cls_compute",
  google_cloud_run_service: "cls_compute",
  google_cloud_run_v2_service: "cls_compute",
  google_container_cluster: "cls_compute",
  google_cloudfunctions_function: "cls_compute",
  google_cloudfunctions2_function: "cls_compute",

  // Database
  aws_db_instance: "cls_database",
  aws_rds_cluster: "cls_database",
  aws_dynamodb_table: "cls_database",
  google_sql_database_instance: "cls_database",
  google_spanner_instance: "cls_database",
  google_bigtable_instance: "cls_database",
  google_firestore_database: "cls_database",

  // Cache
  aws_elasticache_cluster: "cls_cache",
  aws_elasticache_replication_group: "cls_cache",
  google_redis_instance: "cls_cache",
  google_memcache_instance: "cls_cache",

  // Network / Load Balancers
  aws_lb: "cls_network",
  aws_alb: "cls_network",
  aws_vpc: "cls_network",
  aws_subnet: "cls_network",
  aws_security_group: "cls_network",
  aws_api_gateway_rest_api: "cls_network",
  aws_api_gateway_v2_api: "cls_network",
  google_compute_network: "cls_network",
  google_compute_subnetwork: "cls_network",
  google_compute_backend_service: "cls_network",
  google_compute_url_map: "cls_network",
  google_compute_target_http_proxy: "cls_network",
  google_compute_global_forwarding_rule: "cls_network",

  // Storage
  aws_s3_bucket: "cls_storage",
  aws_efs_file_system: "cls_storage",
  google_storage_bucket: "cls_storage",
  google_filestore_instance: "cls_storage",

  // CDN
  aws_cloudfront_distribution: "cls_cdn",
  google_compute_cdn_policy: "cls_cdn",

  // Queue / Messaging
  aws_sqs_queue: "cls_queue",
  aws_sns_topic: "cls_queue",
  aws_kinesis_stream: "cls_queue",
  google_pubsub_topic: "cls_queue",
  google_pubsub_subscription: "cls_queue",
};

export function getResourceClass(resource: string): string | null {
  return RESOURCE_CLASS_MAP[resource] ?? null;
}
