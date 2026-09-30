import type { GraphNode } from "./types";

export type AwsCategory =
  | "Compute"
  | "Storage"
  | "Database"
  | "Networking"
  | "Security"
  | "Integration"
  | "Analytics"
  | "AI"
  | "Management"
  | "Frontend";

export interface AwsService {
  id: string;
  label: string;
  short: string;
  category: AwsCategory;
  type: GraphNode["type"];
  aliases: string[];
  icon: string;
}

const ICON_FILES = import.meta.glob("../assets/aws-icons/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const ICON = (file: string) => {
  const hit = Object.entries(ICON_FILES).find(([path]) =>
    path.endsWith(`/${file}.svg`),
  );
  return hit?.[1] ?? `/aws-icons/${file}.svg`;
};

export const AWS_SERVICES: AwsService[] = [
  { id: "ec2", label: "Amazon EC2", short: "EC2", category: "Compute", type: "SERVICE", aliases: ["ec2", "virtual machine", "instance"], icon: ICON("AmazonEC2") },
  { id: "lambda", label: "AWS Lambda", short: "Lambda", category: "Compute", type: "SERVICE", aliases: ["lambda", "serverless function"], icon: ICON("AWSLambda") },
  { id: "ecs", label: "Amazon ECS", short: "ECS", category: "Compute", type: "SERVICE", aliases: ["ecs", "fargate", "containers"], icon: ICON("AmazonElasticContainerService") },
  { id: "eks", label: "Amazon EKS", short: "EKS", category: "Compute", type: "SERVICE", aliases: ["eks", "kubernetes"], icon: ICON("AmazonElasticKubernetesService") },
  { id: "fargate", label: "AWS Fargate", short: "Fargate", category: "Compute", type: "SERVICE", aliases: ["fargate"], icon: ICON("AWSFargate") },
  { id: "beanstalk", label: "Elastic Beanstalk", short: "Beanstalk", category: "Compute", type: "SERVICE", aliases: ["beanstalk", "elastic beanstalk"], icon: ICON("AWSElasticBeanstalk") },
  { id: "lightsail", label: "Amazon Lightsail", short: "Lightsail", category: "Compute", type: "SERVICE", aliases: ["lightsail"], icon: ICON("AmazonLightsail") },
  { id: "batch", label: "AWS Batch", short: "Batch", category: "Compute", type: "SERVICE", aliases: ["batch"], icon: ICON("AWSBatch") },
  { id: "s3", label: "Amazon S3", short: "S3", category: "Storage", type: "STORAGE", aliases: ["s3", "object storage", "bucket"], icon: ICON("AmazonSimpleStorageService") },
  { id: "ebs", label: "Amazon EBS", short: "EBS", category: "Storage", type: "STORAGE", aliases: ["ebs", "block storage"], icon: ICON("AmazonElasticBlockStore") },
  { id: "efs", label: "Amazon EFS", short: "EFS", category: "Storage", type: "STORAGE", aliases: ["efs", "file system"], icon: ICON("AmazonEFS") },
  { id: "fsx", label: "Amazon FSx", short: "FSx", category: "Storage", type: "STORAGE", aliases: ["fsx"], icon: ICON("AmazonFSx") },
  { id: "glacier", label: "S3 Glacier", short: "Glacier", category: "Storage", type: "STORAGE", aliases: ["glacier", "archive"], icon: ICON("AmazonSimpleStorageServiceGlacier") },
  { id: "rds", label: "Amazon RDS", short: "RDS", category: "Database", type: "STORAGE", aliases: ["rds", "postgres", "mysql", "relational"], icon: ICON("AmazonRDS") },
  { id: "aurora", label: "Amazon Aurora", short: "Aurora", category: "Database", type: "STORAGE", aliases: ["aurora"], icon: ICON("AmazonAurora") },
  { id: "dynamodb", label: "Amazon DynamoDB", short: "DynamoDB", category: "Database", type: "STORAGE", aliases: ["dynamodb", "dynamo", "nosql"], icon: ICON("AmazonDynamoDB") },
  { id: "elasticache", label: "Amazon ElastiCache", short: "ElastiCache", category: "Database", type: "CACHE", aliases: ["elasticache", "redis", "memcached", "cache"], icon: ICON("AmazonElastiCache") },
  { id: "memorydb", label: "Amazon MemoryDB", short: "MemoryDB", category: "Database", type: "CACHE", aliases: ["memorydb"], icon: ICON("AmazonMemoryDB") },
  { id: "redshift", label: "Amazon Redshift", short: "Redshift", category: "Analytics", type: "STORAGE", aliases: ["redshift", "warehouse"], icon: ICON("AmazonRedshift") },
  { id: "documentdb", label: "Amazon DocumentDB", short: "DocumentDB", category: "Database", type: "STORAGE", aliases: ["documentdb", "mongo"], icon: ICON("AmazonDocumentDB") },
  { id: "neptune", label: "Amazon Neptune", short: "Neptune", category: "Database", type: "STORAGE", aliases: ["neptune", "graph db"], icon: ICON("AmazonNeptune") },
  { id: "vpc", label: "Amazon VPC", short: "VPC", category: "Networking", type: "CUSTOM", aliases: ["vpc"], icon: ICON("AmazonVirtualPrivateCloud") },
  { id: "route53", label: "Amazon Route 53", short: "Route 53", category: "Networking", type: "EDGE", aliases: ["route 53", "route53", "dns"], icon: ICON("AmazonRoute53") },
  { id: "cloudfront", label: "Amazon CloudFront", short: "CloudFront", category: "Networking", type: "EDGE", aliases: ["cloudfront", "cdn"], icon: ICON("AmazonCloudFront") },
  { id: "apigateway", label: "Amazon API Gateway", short: "API GW", category: "Networking", type: "GATEWAY", aliases: ["api gateway", "api gw", "apigw", "apigateway"], icon: ICON("AmazonAPIGateway") },
  { id: "elb", label: "Elastic Load Balancing", short: "ELB", category: "Networking", type: "GATEWAY", aliases: ["elb", "alb", "nlb", "load balancer"], icon: ICON("ElasticLoadBalancing") },
  { id: "transitgateway", label: "Transit Gateway", short: "TGW", category: "Networking", type: "GATEWAY", aliases: ["transit gateway", "tgw"], icon: ICON("AWSTransitGateway") },
  { id: "privatelink", label: "AWS PrivateLink", short: "PrivateLink", category: "Networking", type: "GATEWAY", aliases: ["privatelink"], icon: ICON("AWSPrivateLink") },
  { id: "globalaccelerator", label: "Global Accelerator", short: "AGA", category: "Networking", type: "EDGE", aliases: ["global accelerator"], icon: ICON("AWSGlobalAccelerator") },
  { id: "iam", label: "AWS IAM", short: "IAM", category: "Security", type: "SECURITY", aliases: ["iam", "identity access"], icon: ICON("AWSIdentityandAccessManagement") },
  { id: "cognito", label: "Amazon Cognito", short: "Cognito", category: "Security", type: "SECURITY", aliases: ["cognito"], icon: ICON("AmazonCognito") },
  { id: "kms", label: "AWS KMS", short: "KMS", category: "Security", type: "SECURITY", aliases: ["kms", "encryption keys"], icon: ICON("AWSKeyManagementService") },
  { id: "secretsmanager", label: "Secrets Manager", short: "Secrets", category: "Security", type: "SECURITY", aliases: ["secrets manager", "secrets"], icon: ICON("AWSSecretsManager") },
  { id: "waf", label: "AWS WAF", short: "WAF", category: "Security", type: "SECURITY", aliases: ["waf"], icon: ICON("AWSWAF") },
  { id: "shield", label: "AWS Shield", short: "Shield", category: "Security", type: "SECURITY", aliases: ["shield", "ddos"], icon: ICON("AWSShield") },
  { id: "guardduty", label: "Amazon GuardDuty", short: "GuardDuty", category: "Security", type: "SECURITY", aliases: ["guardduty"], icon: ICON("AmazonGuardDuty") },
  { id: "inspector", label: "Amazon Inspector", short: "Inspector", category: "Security", type: "SECURITY", aliases: ["inspector"], icon: ICON("AmazonInspector") },
  { id: "acm", label: "AWS Certificate Manager", short: "ACM", category: "Security", type: "SECURITY", aliases: ["acm", "certificate manager", "tls cert"], icon: ICON("AWSCertificateManager") },
  { id: "sqs", label: "Amazon SQS", short: "SQS", category: "Integration", type: "QUEUE", aliases: ["sqs", "queue"], icon: ICON("AmazonSimpleQueueService") },
  { id: "sns", label: "Amazon SNS", short: "SNS", category: "Integration", type: "TELEMETRY", aliases: ["sns", "notification", "pubsub"], icon: ICON("AmazonSimpleNotificationService") },
  { id: "eventbridge", label: "Amazon EventBridge", short: "EventBridge", category: "Integration", type: "TELEMETRY", aliases: ["eventbridge", "event bus", "bus"], icon: ICON("AmazonEventBridge") },
  { id: "stepfunctions", label: "AWS Step Functions", short: "Steps", category: "Integration", type: "SERVICE", aliases: ["step functions", "state machine"], icon: ICON("AWSStepFunctions") },
  { id: "appsync", label: "AWS AppSync", short: "AppSync", category: "Integration", type: "GATEWAY", aliases: ["appsync", "graphql"], icon: ICON("AWSAppSync") },
  { id: "mq", label: "Amazon MQ", short: "MQ", category: "Integration", type: "QUEUE", aliases: ["amazon mq", "activemq"], icon: ICON("AmazonMQ") },
  { id: "kinesis", label: "Amazon Kinesis", short: "Kinesis", category: "Analytics", type: "TELEMETRY", aliases: ["kinesis", "stream", "data stream"], icon: ICON("AmazonKinesis") },
  { id: "athena", label: "Amazon Athena", short: "Athena", category: "Analytics", type: "SERVICE", aliases: ["athena"], icon: ICON("AmazonAthena") },
  { id: "glue", label: "AWS Glue", short: "Glue", category: "Analytics", type: "SERVICE", aliases: ["glue", "etl"], icon: ICON("AWSGlue") },
  { id: "emr", label: "Amazon EMR", short: "EMR", category: "Analytics", type: "SERVICE", aliases: ["emr", "spark"], icon: ICON("AmazonEMR") },
  { id: "opensearch", label: "Amazon OpenSearch", short: "OpenSearch", category: "Analytics", type: "STORAGE", aliases: ["opensearch", "elasticsearch"], icon: ICON("AmazonOpenSearchService") },
  { id: "quicksight", label: "Amazon QuickSight", short: "QuickSight", category: "Analytics", type: "FRONTEND", aliases: ["quicksight"], icon: ICON("AmazonQuickSuite") },
  { id: "msk", label: "Amazon MSK", short: "MSK", category: "Analytics", type: "TELEMETRY", aliases: ["msk", "kafka", "buffer"], icon: ICON("AmazonManagedStreamingforApacheKafka") },
  { id: "sagemaker", label: "Amazon SageMaker", short: "SageMaker", category: "AI", type: "SERVICE", aliases: ["sagemaker"], icon: ICON("AmazonSageMaker") },
  { id: "bedrock", label: "Amazon Bedrock", short: "Bedrock", category: "AI", type: "SERVICE", aliases: ["bedrock"], icon: ICON("AmazonBedrock") },
  { id: "comprehend", label: "Amazon Comprehend", short: "Comprehend", category: "AI", type: "SERVICE", aliases: ["comprehend"], icon: ICON("AmazonComprehend") },
  { id: "rekognition", label: "Amazon Rekognition", short: "Rekognition", category: "AI", type: "SERVICE", aliases: ["rekognition"], icon: ICON("AmazonRekognition") },
  { id: "textract", label: "Amazon Textract", short: "Textract", category: "AI", type: "SERVICE", aliases: ["textract"], icon: ICON("AmazonTextract") },
  { id: "polly", label: "Amazon Polly", short: "Polly", category: "AI", type: "SERVICE", aliases: ["polly"], icon: ICON("AmazonPolly") },
  { id: "transcribe", label: "Amazon Transcribe", short: "Transcribe", category: "AI", type: "SERVICE", aliases: ["transcribe"], icon: ICON("AmazonTranscribe") },
  { id: "cloudwatch", label: "Amazon CloudWatch", short: "CloudWatch", category: "Management", type: "TELEMETRY", aliases: ["cloudwatch", "metrics", "logs"], icon: ICON("AmazonCloudWatch") },
  { id: "cloudtrail", label: "AWS CloudTrail", short: "CloudTrail", category: "Management", type: "TELEMETRY", aliases: ["cloudtrail"], icon: ICON("AWSCloudTrail") },
  { id: "xray", label: "AWS X-Ray", short: "X-Ray", category: "Management", type: "TELEMETRY", aliases: ["xray", "x-ray", "tracing"], icon: ICON("AWSXRay") },
  { id: "cloudformation", label: "AWS CloudFormation", short: "CFn", category: "Management", type: "SERVICE", aliases: ["cloudformation", "cfn"], icon: ICON("AWSCloudFormation") },
  { id: "cdk", label: "AWS CDK", short: "CDK", category: "Management", type: "SERVICE", aliases: ["cdk"], icon: ICON("AWSCloudDevelopmentKit") },
  { id: "systemsmanager", label: "AWS Systems Manager", short: "SSM", category: "Management", type: "SERVICE", aliases: ["systems manager", "ssm"], icon: ICON("AWSSystemsManager") },
  { id: "config", label: "AWS Config", short: "Config", category: "Management", type: "TELEMETRY", aliases: ["aws config"], icon: ICON("AWSConfig") },
  { id: "organizations", label: "AWS Organizations", short: "Orgs", category: "Management", type: "CUSTOM", aliases: ["organizations"], icon: ICON("AWSOrganizations") },
  { id: "amplify", label: "AWS Amplify", short: "Amplify", category: "Frontend", type: "FRONTEND", aliases: ["amplify"], icon: ICON("AWSAmplify") },
  { id: "apps", label: "AWS App Runner", short: "App Runner", category: "Compute", type: "SERVICE", aliases: ["app runner"], icon: ICON("AWSAppRunner") },
  { id: "ses", label: "Amazon SES", short: "SES", category: "Integration", type: "SERVICE", aliases: ["ses", "email"], icon: ICON("AmazonSimpleEmailService") },
  { id: "cognitoidp", label: "Cognito User Pools", short: "User Pool", category: "Security", type: "SECURITY", aliases: ["user pool"], icon: ICON("AmazonCognito") },
];

export const FEATURED_AWS_IDS = [
  "lambda",
  "s3",
  "ec2",
  "dynamodb",
  "rds",
  "apigateway",
  "iam",
  "cloudfront",
  "sqs",
  "cloudwatch",
];

export function awsIconUrl(service: AwsService) {
  return service.icon;
}

export function aliasMatches(hay: string, alias: string): boolean {
  const a = alias.toLowerCase().trim();
  const h = hay.toLowerCase().trim();
  if (!a) return false;
  if (h === a) return true;
  const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(h);
}

export function resolveAwsService(text: string): AwsService | undefined {
  const hay = text.toLowerCase().trim();
  const ranked = AWS_SERVICES.flatMap((service) =>
    [service.id, service.short, service.label, ...service.aliases].map((alias) => ({
      alias: alias.toLowerCase(),
      service,
    })),
  ).sort((a, b) => b.alias.length - a.alias.length);
  return ranked.find(({ alias }) => aliasMatches(hay, alias))?.service;
}

export function scoreAwsService(query: string, service: AwsService): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const fields = [
    service.id,
    service.short,
    service.label,
    service.category,
    ...service.aliases,
  ].map((v) => v.toLowerCase());
  if (fields.some((f) => f === q)) return 100;
  if (fields.some((f) => f.startsWith(q))) return 80;
  if (fields.some((f) => f.includes(q))) return 60;
  if (q.split(/\s+/).every((part) => fields.some((f) => f.includes(part)))) return 40;
  return 0;
}

export function searchAwsServices(query: string, limit = 10): AwsService[] {
  if (!query.trim()) {
    const featured = FEATURED_AWS_IDS.map(
      (id) => AWS_SERVICES.find((service) => service.id === id)!,
    ).filter(Boolean);
    const rest = AWS_SERVICES.filter((service) => !FEATURED_AWS_IDS.includes(service.id));
    return [...featured, ...rest].slice(0, Math.max(limit, featured.length));
  }
  return AWS_SERVICES.map((service) => ({
    service,
    score: scoreAwsService(query, service),
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.service);
}

export const PRESET_AWS_STACKS: { id: string; triggers: string[]; ids: string[] }[] = [
  {
    id: "SERVERLESS_WEB_APP",
    triggers: ["serverless", "serverless web", "jamstack"],
    ids: ["cloudfront", "s3", "apigateway", "lambda", "dynamodb"],
  },
  {
    id: "EVENT_DRIVEN_PIPELINE",
    triggers: ["event-driven", "event driven", "data pipeline", "event pipeline"],
    ids: ["apigateway", "eventbridge", "sqs", "lambda", "s3", "sns"],
  },
  {
    id: "CONTAINERIZED_MICROSERVICES",
    triggers: ["microservice", "microservices", "container stack", "ecs stack"],
    ids: ["cloudfront", "apigateway", "ecs", "rds", "sqs"],
  },
];

export function magnetAwsIds(prompt: string, hits: AwsService[], limit = 10): string[] {
  const hay = prompt.toLowerCase().trim();
  if (!hay) return [];
  const preset = PRESET_AWS_STACKS.find((row) =>
    row.triggers.some((trigger) => hay.includes(trigger)),
  );
  if (preset) return preset.ids;
  const scored = hits
    .map((service) => ({ service, score: scoreAwsService(hay, service) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.service.id);
  return scored;
}

export function awsToNode(service: AwsService): GraphNode {
  return {
    id: service.id,
    label: service.short,
    type: service.type,
    icon: service.icon,
  };
}
