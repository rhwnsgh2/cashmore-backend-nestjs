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
import * as appscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import { Construct } from 'constructs';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'CashmoreVpc', {
      maxAzs: 2,
      natGateways: 1, // TODO: ECS가 Public Subnet으로 이동 후 수동 삭제 필요
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
          'ecs:RegisterTaskDefinition',
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

    // Reference Upstash Redis secret
    const upstashSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'UpstashSecret',
      'cashmore/upstash',
    );

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'CashmoreTask', {
      memoryLimitMiB: 2048,
      cpu: 1024,
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
        SUPABASE_DB_URL: ecs.Secret.fromSecretsManager(supabaseSecret, 'dbUrl'),
        BATCH_API_KEY: ecs.Secret.fromSecretsManager(
          supabaseSecret,
          'batchApiKey',
        ),
        UPSTASH_REDIS_REST_URL: ecs.Secret.fromSecretsManager(
          upstashSecret,
          'restUrl',
        ),
        UPSTASH_REDIS_REST_TOKEN: ecs.Secret.fromSecretsManager(
          upstashSecret,
          'restToken',
        ),
      },
    });

    container.addPortMappings({
      containerPort: 8000,
    });

    // Grant PassRole for ECS task definition registration (GitHub Actions deploy)
    githubActionsRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['iam:PassRole'],
        resources: [
          taskDefinition.taskRole.roleArn,
          taskDefinition.executionRole!.roleArn,
        ],
      }),
    );

    // CloudWatch Metrics 권한 추가 (API 메트릭 전송용)
    taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'Cashmore/API',
          },
        },
      }),
    );

    // ECS Exec을 위한 SSM 권한 추가
    taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ssmmessages:CreateControlChannel',
          'ssmmessages:CreateDataChannel',
          'ssmmessages:OpenControlChannel',
          'ssmmessages:OpenDataChannel',
        ],
        resources: ['*'],
      }),
    );

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
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      assignPublicIp: true, // Public Subnet에서 인터넷 접근 필요
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      enableExecuteCommand: true, // 컨테이너 디버깅용 ECS Exec 활성화
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
      targetUtilizationPercent: 50,
    });

    // Request Count 기반 스케일링 (응답 지연 전에 미리 스케일 아웃)
    scaling.scaleOnRequestCount('RequestScaling', {
      targetGroup: targetGroup,
      requestsPerTarget: 3000, // 태스크당 분당 3000개 요청 초과 시 스케일 아웃
    });

    // 예약 스케일링: 피크 시간(09, 13, 18, 22시 KST) 10분 전에 미리 태스크 증가
    // 09시 피크 대비 (08:50 KST = 23:50 UTC 전날)
    scaling.scaleOnSchedule('MorningPeakPrepare', {
      schedule: appscaling.Schedule.cron({ hour: '23', minute: '50' }),
      minCapacity: 6,
    });
    scaling.scaleOnSchedule('MorningPeakEnd', {
      schedule: appscaling.Schedule.cron({ hour: '0', minute: '30' }),
      minCapacity: 2,
    });

    // 13시 피크 대비 (12:50 KST = 03:50 UTC)
    scaling.scaleOnSchedule('LunchPeakPrepare', {
      schedule: appscaling.Schedule.cron({ hour: '3', minute: '50' }),
      minCapacity: 6,
    });
    scaling.scaleOnSchedule('LunchPeakEnd', {
      schedule: appscaling.Schedule.cron({ hour: '4', minute: '30' }),
      minCapacity: 2,
    });

    // 18시 피크 대비 (17:50 KST = 08:50 UTC)
    scaling.scaleOnSchedule('EveningPeakPrepare', {
      schedule: appscaling.Schedule.cron({ hour: '8', minute: '50' }),
      minCapacity: 6,
    });
    scaling.scaleOnSchedule('EveningPeakEnd', {
      schedule: appscaling.Schedule.cron({ hour: '9', minute: '30' }),
      minCapacity: 2,
    });

    // 22시 피크 대비 (21:50 KST = 12:50 UTC)
    scaling.scaleOnSchedule('NightPeakPrepare', {
      schedule: appscaling.Schedule.cron({ hour: '12', minute: '50' }),
      minCapacity: 6,
    });
    scaling.scaleOnSchedule('NightPeakEnd', {
      schedule: appscaling.Schedule.cron({ hour: '13', minute: '30' }),
      minCapacity: 2,
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
const { ECSClient, DescribeServicesCommand, DescribeTasksCommand, ListTasksCommand, DescribeTaskDefinitionCommand } = require('@aws-sdk/client-ecs');
const { ApplicationAutoScalingClient, DescribeScalingActivitiesCommand } = require('@aws-sdk/client-application-auto-scaling');

const secretsClient = new SecretsManagerClient({ region: 'ap-northeast-2' });
const ecsClient = new ECSClient({ region: 'ap-northeast-2' });
const autoScalingClient = new ApplicationAutoScalingClient({ region: 'ap-northeast-2' });
let cachedWebhookUrl = null;

async function getWebhookUrl() {
  if (cachedWebhookUrl) return cachedWebhookUrl;
  const command = new GetSecretValueCommand({ SecretId: 'cashmore/slack-webhook' });
  const response = await secretsClient.send(command);
  cachedWebhookUrl = response.SecretString;
  return cachedWebhookUrl;
}

async function getServiceDetails(clusterArn, serviceName) {
  try {
    // Get service info
    const serviceResp = await ecsClient.send(new DescribeServicesCommand({
      cluster: clusterArn,
      services: [serviceName]
    }));
    const svc = serviceResp.services?.[0];
    if (!svc) return null;

    // Get task definition details
    const taskDefResp = await ecsClient.send(new DescribeTaskDefinitionCommand({
      taskDefinition: svc.taskDefinition
    }));
    const container = taskDefResp.taskDefinition?.containerDefinitions?.[0];
    const image = container?.image || 'unknown';

    // Extract image tag (commit hash)
    const imageTag = image.split(':')[1] || 'latest';

    // Get running tasks
    const listTasksResp = await ecsClient.send(new ListTasksCommand({
      cluster: clusterArn,
      serviceName: serviceName,
      desiredStatus: 'RUNNING'
    }));

    return {
      runningCount: svc.runningCount,
      desiredCount: svc.desiredCount,
      pendingCount: svc.pendingCount,
      imageTag: imageTag,
      deployments: svc.deployments || []
    };
  } catch (err) {
    console.error('Failed to get service details:', err);
    return null;
  }
}

async function getScalingReason(clusterName, serviceName) {
  try {
    const resourceId = 'service/' + clusterName + '/' + serviceName;
    const resp = await autoScalingClient.send(new DescribeScalingActivitiesCommand({
      ServiceNamespace: 'ecs',
      ResourceId: resourceId,
      MaxResults: 1
    }));

    const activity = resp.ScalingActivities?.[0];
    if (!activity) return null;

    // 최근 10분 이내의 활동만 반환
    const activityTime = new Date(activity.StartTime);
    const now = new Date();
    if ((now - activityTime) > 10 * 60 * 1000) return null;

    return {
      cause: activity.Cause || 'Unknown',
      description: activity.Description || '',
      statusCode: activity.StatusCode,
      startTime: activity.StartTime
    };
  } catch (err) {
    console.error('Failed to get scaling reason:', err);
    return null;
  }
}

exports.handler = async (event) => {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) return;

  const detail = event.detail;
  const eventName = detail.eventName;
  const clusterArn = detail.clusterArn;

  // resources에서 서비스 ARN 추출 (예: arn:aws:ecs:region:account:service/cluster-name/service-name)
  const serviceArn = event.resources?.[0] || '';
  const serviceName = serviceArn.split('/').pop() || 'unknown';

  let payload;

  if (eventName === 'SERVICE_STEADY_STATE') {
    // 서비스 안정 상태 - 스케일링인지 배포인지 구분
    const clusterName = clusterArn.split('/').pop();
    const info = await getServiceDetails(clusterArn, serviceName);
    const scalingInfo = await getScalingReason(clusterName, serviceName);

    // 최근 스케일링 활동이 있으면 스케일링 완료, 없으면 배포 완료
    // statusCode가 InProgress나 Successful이면 스케일링 이벤트로 처리
    if (scalingInfo && (scalingInfo.statusCode === 'Successful' || scalingInfo.statusCode === 'InProgress')) {
      // 스케일링 완료 알림
      let scalingType = '스케일링';
      let emoji = '📊';
      let metricType = '알 수 없음';
      let direction = '';

      if (scalingInfo.cause) {
        // 스케일링 타입 감지 (정책 이름에서 CpuScaling 또는 RequestScaling 확인)
        if (scalingInfo.cause.includes('CpuScaling')) {
          metricType = 'CPU';
        } else if (scalingInfo.cause.includes('RequestScaling')) {
          metricType = '요청 수';
        } else if (scalingInfo.cause.includes('minimum capacity')) {
          metricType = '최소 용량';
        } else if (scalingInfo.cause.includes('maximum capacity')) {
          metricType = '최대 용량';
        }

        // 스케일 방향 감지 (AlarmHigh = 스케일 아웃, AlarmLow = 스케일 인)
        if (scalingInfo.cause.includes('AlarmHigh')) {
          direction = '아웃';
          emoji = '📈';
        } else if (scalingInfo.cause.includes('AlarmLow')) {
          direction = '인';
          emoji = '📉';
        }

        scalingType = metricType + ' 기반 스케일' + direction;
      }

      // description에서 목표 태스크 수 추출 (예: "Setting desired count to 6.")
      let targetCount = '-';
      if (scalingInfo.description) {
        const match = scalingInfo.description.match(/Setting desired count to (\\d+)/);
        if (match) {
          targetCount = match[1];
        }
      }

      // 태스크 변경 정보 구성
      const currentCount = info?.runningCount || '-';
      const taskChange = targetCount !== '-' ? currentCount + ' → ' + targetCount + '개' : currentCount + '개';

      payload = {
        text: emoji + ' *' + scalingType + '*',
        attachments: [{
          color: direction === '아웃' ? '#FF9800' : '#2196F3',
          fields: [
            { title: '서비스', value: serviceName, short: true },
            { title: '태스크 변경', value: taskChange, short: true },
            { title: '트리거', value: metricType + ' 임계값 ' + (direction === '아웃' ? '초과' : '미만'), short: true },
            { title: '완료 시각', value: event.time, short: true }
          ]
        }]
      };
    } else if (info) {
      // 배포 완료 알림
      payload = {
        text: '✅ *배포 완료*',
        attachments: [{
          color: '#4CAF50',
          fields: [
            { title: '서비스', value: serviceName, short: true },
            { title: '이미지 태그', value: info.imageTag, short: true },
            { title: '실행 중 태스크', value: String(info.runningCount) + '개', short: true },
            { title: '완료 시각', value: event.time, short: false }
          ]
        }]
      };
    } else {
      payload = {
        text: '✅ *서비스 안정 상태*',
        attachments: [{
          color: '#4CAF50',
          fields: [
            { title: '서비스', value: serviceName, short: true },
            { title: '완료 시각', value: event.time, short: false }
          ]
        }]
      };
    }
  } else if (eventName === 'SERVICE_DEPLOYMENT_IN_PROGRESS') {
    // 배포 시작
    const info = await getServiceDetails(clusterArn, serviceName);

    payload = {
      text: '🔄 *배포 시작*',
      attachments: [{
        color: '#FF9800',
        fields: [
          { title: '서비스', value: serviceName, short: true },
          { title: '새 이미지', value: info?.imageTag || 'unknown', short: true },
          { title: '현재 태스크', value: info ? String(info.runningCount) + '개' : '-', short: true },
          { title: '목표 태스크', value: info ? String(info.desiredCount) + '개' : '-', short: true },
          { title: '시작 시각', value: event.time, short: false }
        ]
      }]
    };
  } else if (eventName === 'SERVICE_DEPLOYMENT_COMPLETED') {
    // 배포 완료 (STEADY_STATE와 별도)
    const info = await getServiceDetails(clusterArn, serviceName);

    payload = {
      text: '✅ *배포 완료*',
      attachments: [{
        color: '#4CAF50',
        fields: [
          { title: '서비스', value: serviceName, short: true },
          { title: '이미지 태그', value: info?.imageTag || 'unknown', short: true },
          { title: '실행 중 태스크', value: info ? String(info.runningCount) + '개' : '-', short: true },
          { title: '완료 시각', value: event.time, short: false }
        ]
      }]
    };
  } else if (eventName === 'SERVICE_DEPLOYMENT_FAILED') {
    // 배포 실패 (circuit breaker 롤백 등)
    const info = await getServiceDetails(clusterArn, serviceName);
    const reason = detail.eventDetail?.reason || 'unknown';

    payload = {
      text: '🚨 *배포 실패*',
      attachments: [{
        color: '#F44336',
        fields: [
          { title: '서비스', value: serviceName, short: true },
          { title: '이미지 태그', value: info?.imageTag || 'unknown', short: true },
          { title: '실패 사유', value: reason, short: false },
          { title: '실행 중 태스크', value: info ? String(info.runningCount) + '개' : '-', short: true },
          { title: '실패 시각', value: event.time, short: false }
        ]
      }]
    };
  } else if (eventName === 'SERVICE_DESIRED_COUNT_UPDATED') {
    // Auto Scaling 이벤트 (참고: AWS 제한으로 Auto Scaling 시에는 이 이벤트가 발생하지 않음)
    const clusterName = clusterArn.split('/').pop();
    const info = await getServiceDetails(clusterArn, serviceName);
    const scalingInfo = await getScalingReason(clusterName, serviceName);

    // 스케일링 이유 파싱 (정책 이름에서 CpuScaling 또는 RequestScaling 확인)
    let metricType = '수동';
    let emoji = '📊';
    let direction = '';

    if (scalingInfo?.cause) {
      if (scalingInfo.cause.includes('CpuScaling')) {
        metricType = 'CPU';
      } else if (scalingInfo.cause.includes('RequestScaling')) {
        metricType = '요청 수';
      } else if (scalingInfo.cause.includes('minimum capacity')) {
        metricType = '최소 용량';
      } else if (scalingInfo.cause.includes('maximum capacity')) {
        metricType = '최대 용량';
      }

      if (scalingInfo.cause.includes('AlarmHigh')) {
        direction = ' 아웃';
        emoji = '📈';
      } else if (scalingInfo.cause.includes('AlarmLow')) {
        direction = ' 인';
        emoji = '📉';
      }
    }

    // description에서 목표 태스크 수 추출
    let targetCount = info?.desiredCount || '-';
    if (scalingInfo?.description) {
      const match = scalingInfo.description.match(/Setting desired count to (\\d+)/);
      if (match) {
        targetCount = match[1];
      }
    }

    const runningCount = info?.runningCount || '-';
    const taskChange = runningCount + ' → ' + targetCount + '개';

    payload = {
      text: emoji + ' *' + metricType + ' 기반 스케일' + direction + '*',
      attachments: [{
        color: direction === ' 아웃' ? '#FF9800' : '#2196F3',
        fields: [
          { title: '서비스', value: serviceName, short: true },
          { title: '태스크 변경', value: taskChange, short: true },
          { title: '트리거', value: metricType + ' 임계값 ' + (direction === ' 아웃' ? '초과' : '미만'), short: true },
          { title: '시각', value: event.time, short: true }
        ]
      }]
    };
  } else if (eventName === 'SERVICE_TASK_START_IMPACTED') {
    // 태스크 시작
    const info = await getServiceDetails(clusterArn, serviceName);
    const taskCount = detail.taskArns?.length || 1;

    payload = {
      text: '🟢 *태스크 시작*',
      attachments: [{
        color: '#4CAF50',
        fields: [
          { title: '서비스', value: serviceName, short: true },
          { title: '시작된 태스크', value: String(taskCount) + '개', short: true },
          { title: '현재 실행 중', value: info ? String(info.runningCount) + '개' : '-', short: true },
          { title: '목표', value: info ? String(info.desiredCount) + '개' : '-', short: true },
          { title: '시각', value: event.time, short: false }
        ]
      }]
    };
  } else if (eventName === 'SERVICE_TASK_STOP_IMPACTED') {
    // 태스크 중지
    const info = await getServiceDetails(clusterArn, serviceName);
    const taskCount = detail.taskArns?.length || 1;
    const stoppedReason = detail.stoppedReason || '알 수 없음';

    payload = {
      text: '🔴 *태스크 중지*',
      attachments: [{
        color: '#F44336',
        fields: [
          { title: '서비스', value: serviceName, short: true },
          { title: '중지된 태스크', value: String(taskCount) + '개', short: true },
          { title: '현재 실행 중', value: info ? String(info.runningCount) + '개' : '-', short: true },
          { title: '목표', value: info ? String(info.desiredCount) + '개' : '-', short: true },
          { title: '중지 이유', value: stoppedReason.substring(0, 100), short: false },
          { title: '시각', value: event.time, short: false }
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
    req.on('error', (err) => {
      console.error('Slack request error:', err);
      reject(err);
    });
    req.write(JSON.stringify(payload));
    req.end();
  });
};
      `),
        timeout: cdk.Duration.seconds(30),
      },
    );

    // Lambda에 ECS 읽기 권한 부여
    scalingEventLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'ecs:DescribeServices',
          'ecs:DescribeTasks',
          'ecs:ListTasks',
          'ecs:DescribeTaskDefinition',
        ],
        resources: ['*'],
      }),
    );

    // Lambda에 Application Auto Scaling 읽기 권한 부여
    scalingEventLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['application-autoscaling:DescribeScalingActivities'],
        resources: ['*'],
      }),
    );

    slackWebhookSecret.grantRead(scalingEventLambda);

    // EventBridge Rule for ECS Deployment Events
    new events.Rule(this, 'EcsScalingRule', {
      ruleName: 'cashmore-ecs-events',
      eventPattern: {
        source: ['aws.ecs'],
        detailType: ['ECS Service Action'],
        detail: {
          clusterArn: [cluster.clusterArn],
          // eventType 필터 제거 - INFO, WARN 등 모든 타입 캡처
          eventName: [
            'SERVICE_DEPLOYMENT_IN_PROGRESS', // 배포 시작
            'SERVICE_DEPLOYMENT_COMPLETED', // 배포 완료
            'SERVICE_DEPLOYMENT_FAILED', // 배포 실패
            'SERVICE_STEADY_STATE', // 서비스 안정 상태
            'SERVICE_DESIRED_COUNT_UPDATED', // Auto Scaling
            'SERVICE_TASK_START_IMPACTED', // 태스크 시작 영향
            'SERVICE_TASK_STOP_IMPACTED', // 태스크 중지 영향
          ],
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
