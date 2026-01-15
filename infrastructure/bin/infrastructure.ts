#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/infrastructure-stack';

const app = new cdk.App();
new InfrastructureStack(app, 'CashmoreBackendStack', {
  env: {
    region: 'ap-northeast-2', // 서울
  },
});
