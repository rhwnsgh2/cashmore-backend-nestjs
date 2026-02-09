import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export class DataCollectorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Secrets Manager에서 시크릿 참조
    const applovinSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'ApplovinSecret',
      'cashmore/applovin'
    );

    const bigquerySecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'BigQuerySecret',
      'cashmore/bigquery'
    );

    // Log Group
    const logGroup = new logs.LogGroup(this, 'ApplovinCollectorLogGroup', {
      logGroupName: '/aws/lambda/cashmore-applovin-collector',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Function
    const applovinCollector = new nodejs.NodejsFunction(
      this,
      'ApplovinCollector',
      {
        functionName: 'cashmore-applovin-collector',
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../../data-collector/src/handlers/applovin.ts'),
        timeout: cdk.Duration.minutes(15),
        memorySize: 3008,  // 1.87M rows 처리를 위해 메모리 증가
        environment: {
          ANDROID_PACKAGE_NAME: 'com.bridgeworks.cashmore',
          IOS_PACKAGE_NAME: 'com.bridgeworks.ios.cashmore',
          BIGQUERY_DATASET_ID: 'applovin',
        },
        bundling: {
          minify: true,
          sourceMap: true,
          externalModules: [],
          nodeModules: ['@google-cloud/bigquery'],
          format: nodejs.OutputFormat.ESM,
          mainFields: ['module', 'main'],
          esbuildArgs: {
            '--platform': 'node',
          },
        },
        logGroup,
      }
    );

    // Lambda에 Secrets Manager 읽기 권한 부여
    applovinSecret.grantRead(applovinCollector);
    bigquerySecret.grantRead(applovinCollector);

    // Lambda에서 시크릿 값을 환경변수로 사용
    applovinCollector.addEnvironment(
      'APPLOVIN_API_KEY_SECRET_ARN',
      applovinSecret.secretArn
    );
    applovinCollector.addEnvironment(
      'BIGQUERY_SECRET_ARN',
      bigquerySecret.secretArn
    );

    // EventBridge Rule - 매일 KST 04:00 (UTC 19:00)
    new events.Rule(this, 'DailyCollectorSchedule', {
      ruleName: 'cashmore-applovin-daily-collector',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '19',  // UTC 19:00 = KST 04:00
      }),
      targets: [new targets.LambdaFunction(applovinCollector)],
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApplovinCollectorArn', {
      value: applovinCollector.functionArn,
      description: 'AppLovin Collector Lambda ARN',
    });

    new cdk.CfnOutput(this, 'ApplovinCollectorLogGroupName', {
      value: logGroup.logGroupName,
      description: 'AppLovin Collector Log Group',
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'Cashmore');
    cdk.Tags.of(this).add('Component', 'DataCollector');
  }
}
