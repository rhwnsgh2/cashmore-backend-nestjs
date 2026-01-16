import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'CashmoreVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // ECR Repository (import existing)
    const repository = ecr.Repository.fromRepositoryName(
      this,
      'CashmoreRepo',
      'cashmore-backend',
    );

    // GitHub OIDC Provider
    const githubProvider = new iam.OpenIdConnectProvider(
      this,
      'GithubOidcProvider',
      {
        url: 'https://token.actions.githubusercontent.com',
        clientIds: ['sts.amazonaws.com'],
      },
    );

    // GitHub Actions IAM Role
    const githubActionsRole = new iam.Role(this, 'GithubActionsRole', {
      roleName: 'cashmore-github-actions-role',
      assumedBy: new iam.WebIdentityPrincipal(
        githubProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub':
              'repo:rhwnsgh2/cashmore-backend-nestjs:*',
          },
        },
      ),
    });

    // Grant ECR permissions
    repository.grantPullPush(githubActionsRole);

    // Grant ECS deployment permissions
    githubActionsRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ecs:UpdateService',
          'ecs:DescribeServices',
          'ecs:DescribeTaskDefinition',
        ],
        resources: ['*'],
      }),
    );

    // Grant ECR login permission
    githubActionsRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }),
    );

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'CashmoreCluster', {
      vpc,
      clusterName: 'cashmore-cluster',
      containerInsights: true,
    });

    // Reference Supabase secret
    const supabaseSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'SupabaseSecret',
      'cashmore/supabase',
    );

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'CashmoreTask', {
      memoryLimitMiB: 1024,
      cpu: 512,
    });

    // Log Group
    const logGroup = new logs.LogGroup(this, 'CashmoreLogGroup', {
      logGroupName: '/ecs/cashmore',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Container
    const container = taskDefinition.addContainer('CashmoreContainer', {
      image: ecs.ContainerImage.fromEcrRepository(repository),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'cashmore',
        logGroup: logGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '8000',
      },
      secrets: {
        SUPABASE_URL: ecs.Secret.fromSecretsManager(supabaseSecret, 'url'),
        SUPABASE_ANON_KEY: ecs.Secret.fromSecretsManager(
          supabaseSecret,
          'anonKey',
        ),
        SUPABASE_SERVICE_ROLE_KEY: ecs.Secret.fromSecretsManager(
          supabaseSecret,
          'serviceRoleKey',
        ),
        SUPABASE_JWT_SECRET: ecs.Secret.fromSecretsManager(
          supabaseSecret,
          'jwtSecret',
        ),
      },
    });

    container.addPortMappings({
      containerPort: 8000,
    });

    // S3 Bucket for ALB Access Logs
    const albLogsBucket = new s3.Bucket(this, 'AlbLogsBucket', {
      bucketName: `cashmore-alb-logs-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(30),
        },
      ],
    });

    // ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'CashmoreAlb', {
      vpc,
      internetFacing: true,
    });

    // Enable ALB Access Logs
    alb.logAccessLogs(albLogsBucket, 'alb-logs');

    // ACM Certificate for api.cashmore.kr (DNS validation - manual)
    const certificate = new acm.Certificate(this, 'CashmoreCertificate', {
      domainName: 'api.cashmore.kr',
      validation: acm.CertificateValidation.fromDns(),
    });

    // ECS Service
    const service = new ecs.FargateService(this, 'CashmoreService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      serviceName: 'cashmore-service',
      circuitBreaker: {
        enable: true,
        rollback: true,
      },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    // Security: ALB에서만 ECS로 접근 허용
    service.connections.allowFrom(alb, ec2.Port.tcp(8000));

    // HTTPS Listener (port 443)
    const httpsListener = alb.addListener('CashmoreHttpsListener', {
      port: 443,
      certificates: [certificate],
    });

    // HTTP Listener (port 80) - Redirect to HTTPS
    alb.addListener('CashmoreListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });

    const targetGroup = httpsListener.addTargets('CashmoreTarget', {
      port: 8000,
      targets: [service],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
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

    // SNS Topic for Alarms
    const alarmTopic = new sns.Topic(this, 'CashmoreAlarmTopic', {
      topicName: 'cashmore-alarms',
    });

    // Reference existing Slack webhook secret
    const slackWebhookSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'SlackWebhookSecret',
      'cashmore/slack-webhook',
    );

    // Lambda for Slack Notification
    const slackNotifierLambda = new lambda.Function(this, 'SlackNotifier', {
      functionName: 'cashmore-slack-notifier',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const https = require('https');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({ region: 'ap-northeast-2' });
let cachedWebhookUrl = null;

async function getWebhookUrl() {
  if (cachedWebhookUrl) return cachedWebhookUrl;
  const command = new GetSecretValueCommand({ SecretId: 'cashmore/slack-webhook' });
  const response = await client.send(command);
  cachedWebhookUrl = response.SecretString;
  return cachedWebhookUrl;
}

exports.handler = async (event) => {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) {
    console.error('Failed to get webhook URL');
    return;
  }

  const message = JSON.parse(event.Records[0].Sns.Message);
  const alarmName = message.AlarmName;
  const newState = message.NewStateValue;
  const reason = message.NewStateReason;
  const timestamp = message.StateChangeTime;
  const region = 'ap-northeast-2';

  const color = newState === 'ALARM' ? '#F44336' : '#4CAF50';
  const emoji = newState === 'ALARM' ? '🚨' : '✅';
  const stateKorean = newState === 'ALARM' ? '경보 발생' : '정상 복구';

  // AWS Console URLs
  const alarmUrl = 'https://' + region + '.console.aws.amazon.com/cloudwatch/home?region=' + region + '#alarmsV2:alarm/' + encodeURIComponent(alarmName);
  const logsUrl = 'https://' + region + '.console.aws.amazon.com/cloudwatch/home?region=' + region + '#logsV2:log-groups/log-group/$252Fecs$252Fcashmore';
  const ecsUrl = 'https://' + region + '.console.aws.amazon.com/ecs/v2/clusters/cashmore-cluster/services/cashmore-service?region=' + region;

  const links = '<' + alarmUrl + '|알람 상세> | <' + logsUrl + '|로그 확인> | <' + ecsUrl + '|ECS 서비스>';

  const payload = {
    text: emoji + ' *CloudWatch 알람*',
    attachments: [{
      color: color,
      fields: [
        { title: '알람명', value: alarmName, short: true },
        { title: '상태', value: stateKorean, short: true },
        { title: '원인', value: reason, short: false },
        { title: '발생 시각', value: timestamp, short: true },
        { title: '바로가기', value: links, short: false }
      ]
    }]
  };

  const url = new URL(webhookUrl);
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve({ statusCode: 200 }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
};
      `),
      timeout: cdk.Duration.seconds(10),
    });

    // Grant Lambda permission to read the secret
    slackWebhookSecret.grantRead(slackNotifierLambda);

    // Subscribe Lambda to SNS Topic
    alarmTopic.addSubscription(
      new sns_subscriptions.LambdaSubscription(slackNotifierLambda),
    );

    // CloudWatch Alarms

    // 1. ECS CPU High
    const cpuAlarm = new cloudwatch.Alarm(this, 'EcsCpuAlarm', {
      alarmName: 'cashmore-ecs-cpu-high',
      metric: service.metricCpuUtilization({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'ECS CPU > 80%',
    });
    cpuAlarm.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
    cpuAlarm.addOkAction(new cw_actions.SnsAction(alarmTopic));

    // 2. ECS Memory High
    const memoryAlarm = new cloudwatch.Alarm(this, 'EcsMemoryAlarm', {
      alarmName: 'cashmore-ecs-memory-high',
      metric: service.metricMemoryUtilization({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'ECS Memory > 80%',
    });
    memoryAlarm.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
    memoryAlarm.addOkAction(new cw_actions.SnsAction(alarmTopic));

    // 3. ALB 5xx Errors
    const http5xxAlarm = new cloudwatch.Alarm(this, 'Alb5xxAlarm', {
      alarmName: 'cashmore-alb-5xx-errors',
      metric: alb.metrics.httpCodeElb(elbv2.HttpCodeElb.ELB_5XX_COUNT, {
        period: cdk.Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'ALB 5xx errors > 10 per minute',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    http5xxAlarm.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
    http5xxAlarm.addOkAction(new cw_actions.SnsAction(alarmTopic));

    // 4. Unhealthy Host Count
    const unhealthyHostAlarm = new cloudwatch.Alarm(
      this,
      'UnhealthyHostAlarm',
      {
        alarmName: 'cashmore-unhealthy-hosts',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'UnHealthyHostCount',
          dimensionsMap: {
            TargetGroup: targetGroup.targetGroupFullName,
            LoadBalancer: alb.loadBalancerFullName,
          },
          period: cdk.Duration.minutes(1),
          statistic: 'Average',
        }),
        threshold: 0,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: 'Unhealthy 호스트 감지',
      },
    );
    unhealthyHostAlarm.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
    unhealthyHostAlarm.addOkAction(new cw_actions.SnsAction(alarmTopic));

    // 5. Running Task Count Low
    const taskCountAlarm = new cloudwatch.Alarm(this, 'TaskCountAlarm', {
      alarmName: 'cashmore-task-count-low',
      metric: new cloudwatch.Metric({
        namespace: 'ECS/ContainerInsights',
        metricName: 'RunningTaskCount',
        dimensionsMap: {
          ClusterName: cluster.clusterName,
          ServiceName: service.serviceName,
        },
        period: cdk.Duration.minutes(1),
        statistic: 'Average',
      }),
      threshold: 2,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      alarmDescription: 'Running tasks < 2',
    });
    taskCountAlarm.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
    taskCountAlarm.addOkAction(new cw_actions.SnsAction(alarmTopic));

    // 6. ALB Response Time High
    const responseTimeAlarm = new cloudwatch.Alarm(this, 'ResponseTimeAlarm', {
      alarmName: 'cashmore-response-time-high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'TargetResponseTime',
        dimensionsMap: {
          LoadBalancer: alb.loadBalancerFullName,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Response time > 1 second',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    responseTimeAlarm.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
    responseTimeAlarm.addOkAction(new cw_actions.SnsAction(alarmTopic));

    // ECS Scaling Event Lambda
    const scalingEventLambda = new lambda.Function(
      this,
      'ScalingEventNotifier',
      {
        functionName: 'cashmore-scaling-notifier',
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline(`
const https = require('https');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({ region: 'ap-northeast-2' });
let cachedWebhookUrl = null;

async function getWebhookUrl() {
  if (cachedWebhookUrl) return cachedWebhookUrl;
  const command = new GetSecretValueCommand({ SecretId: 'cashmore/slack-webhook' });
  const response = await client.send(command);
  cachedWebhookUrl = response.SecretString;
  return cachedWebhookUrl;
}

exports.handler = async (event) => {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) return;

  const detail = event.detail;
  const eventName = detail.eventName;
  const serviceName = detail.serviceName;

  let payload;

  if (eventName === 'SERVICE_STEADY_STATE') {
    // 배포 완료 알림
    payload = {
      text: '✅ *배포 완료*',
      attachments: [{
        color: '#4CAF50',
        fields: [
          { title: '서비스', value: serviceName, short: true },
          { title: '상태', value: '모든 태스크 정상 실행 중', short: true },
          { title: '완료 시각', value: event.time, short: false }
        ]
      }]
    };
  } else if (eventName === 'SERVICE_DESIRED_COUNT_UPDATED') {
    // 스케일링 이벤트
    const desiredCount = detail.desiredCount;
    const runningCount = detail.runningCount;
    payload = {
      text: '📊 *ECS 스케일링 이벤트*',
      attachments: [{
        color: '#2196F3',
        fields: [
          { title: '서비스', value: serviceName, short: true },
          { title: '목표 태스크 수', value: String(desiredCount), short: true },
          { title: '실행 중인 태스크 수', value: String(runningCount), short: true },
          { title: '발생 시각', value: event.time, short: true }
        ]
      }]
    };
  } else {
    return; // 알 수 없는 이벤트는 무시
  }

  const url = new URL(webhookUrl);
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve({ statusCode: 200 }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
};
      `),
        timeout: cdk.Duration.seconds(10),
      },
    );

    slackWebhookSecret.grantRead(scalingEventLambda);

    // EventBridge Rule for ECS Service Events (Scaling + Deployment Complete)
    new events.Rule(this, 'EcsScalingRule', {
      ruleName: 'cashmore-ecs-events',
      eventPattern: {
        source: ['aws.ecs'],
        detailType: ['ECS Service Action'],
        detail: {
          clusterArn: [cluster.clusterArn],
          eventType: ['INFO'],
          eventName: ['SERVICE_DESIRED_COUNT_UPDATED', 'SERVICE_STEADY_STATE'],
        },
      },
      targets: [new events_targets.LambdaFunction(scalingEventLambda)],
    });

    // Outputs
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS Name',
    });

    new cdk.CfnOutput(this, 'ApiDomainName', {
      value: 'https://api.cashmore.kr',
      description: 'API Domain',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: `${this.account}.dkr.ecr.${this.region}.amazonaws.com/cashmore-backend`,
      description: 'ECR Repository URI',
    });

    new cdk.CfnOutput(this, 'GithubActionsRoleArn', {
      value: githubActionsRole.roleArn,
      description: 'GitHub Actions IAM Role ARN',
    });

    // Resource Tagging
    cdk.Tags.of(this).add('Project', 'Cashmore');
    cdk.Tags.of(this).add('Environment', 'Production');
  }
}
