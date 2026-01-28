#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/infrastructure-stack';
import { DataCollectorStack } from '../lib/data-collector-stack';

const app = new cdk.App();

new InfrastructureStack(app, 'CashmoreBackendStack', {
  env: {
    region: 'ap-northeast-2', // 서울
  },
});

new DataCollectorStack(app, 'CashmoreDataCollectorStack', {
  env: {
    region: 'ap-northeast-2', // 서울
  },
});
