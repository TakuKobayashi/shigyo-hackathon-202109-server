import type { AWS } from '@serverless/typescript';
const dotenvConfig = require("dotenv").config()

const serverlessConfiguration: AWS = {
  service: 'shigyo-hackathon-202109-server',
  frameworkVersion: '2',
  custom: {
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      exclude: ['aws-sdk'],
      target: 'node14',
      define: { 'require.resolve': undefined },
      platform: 'node',
    },
    dotenv: {
      path: './.env',
      include: Object.keys(dotenvConfig.parsed),
    },
  },
  plugins: ['serverless-esbuild', 'serverless-dotenv-plugin', 'serverless-offline'],
  provider: {
    name: 'aws',
    runtime: 'nodejs14.x',
    region: 'ap-northeast-1',
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      NODE_OPTIONS: '--enable-source-maps --stack-trace-limit=1000',
    },
    lambdaHashingVersion: '20201221',
  },
  // import the function via paths
  functions: {
    app: {
      handler: 'src/app.handler',
      memorySize: 128,
      timeout: 900,
      events: [
        {
          http: {
            method: 'ANY',
            path: '/',
          },
        },
        {
          http: {
            method: 'ANY',
            path: '/{proxy+}',
          },
        },
      ],
    },
  },
};

module.exports = serverlessConfiguration;
