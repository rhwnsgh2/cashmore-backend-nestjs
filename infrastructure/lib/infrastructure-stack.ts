import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'CashmoreVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // ECR Repository
    const repository = new ecr.Repository(this, 'CashmoreRepo', {
      repositoryName: 'cashmore-backend',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'CashmoreCluster', {
      vpc,
      clusterName: 'cashmore-cluster',
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'CashmoreTask', {
      memoryLimitMiB: 1024,
      cpu: 512,
    });

    // Container
    const container = taskDefinition.addContainer('CashmoreContainer', {
      image: ecs.ContainerImage.fromEcrRepository(repository),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'cashmore' }),
      environment: {
        NODE_ENV: 'production',
        PORT: '8000',
      },
    });

    container.addPortMappings({
      containerPort: 8000,
    });

    // ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'CashmoreAlb', {
      vpc,
      internetFacing: true,
    });

    // ECS Service
    const service = new ecs.FargateService(this, 'CashmoreService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      serviceName: 'cashmore-service',
    });

    // ALB Target Group
    const listener = alb.addListener('CashmoreListener', {
      port: 80,
    });

    listener.addTargets('CashmoreTarget', {
      port: 8000,
      targets: [service],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
      },
    });

    // Auto Scaling
    const scaling = service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });

    // Outputs
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS Name',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: repository.repositoryUri,
      description: 'ECR Repository URI',
    });
  }
}
