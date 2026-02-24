import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  CreateTableCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  APIGatewayClient,
  CreateRestApiCommand,
  GetResourcesCommand,
  CreateResourceCommand,
  PutMethodCommand,
  PutIntegrationCommand,
  PutMethodResponseCommand,
  PutIntegrationResponseCommand,
  CreateDeploymentCommand,
  CreateApiKeyCommand,
  CreateUsagePlanCommand,
  CreateUsagePlanKeyCommand,
} from '@aws-sdk/client-api-gateway';
import { IAMClient, GetRoleCommand } from '@aws-sdk/client-iam';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const REGION = 'eu-west-1';
const BUCKET_NAME = 'ships-capstone-project-bucket';
const TABLE_NAME = 'ShipsTable';
const API_NAME = 'ShipsAPI';

// Initialize AWS clients
const s3Client = new S3Client({ region: REGION });
const dynamoDBClient = new DynamoDBClient({ region: REGION });
const apiGatewayClient = new APIGatewayClient({ region: REGION });
const iamClient = new IAMClient({ region: REGION });

/**
 * Get IAM role ARN
 */
async function getRoleArn(roleName: string): Promise<string> {
  try {
    const response = await iamClient.send(
      new GetRoleCommand({ RoleName: roleName })
    );
    return response.Role!.Arn!;
  } catch (error) {
    throw new Error(`Failed to get role ARN for ${roleName}. Make sure the role exists.`);
  }
}

// Main function to execute all operations
async function deploy() {
  try {
    console.log('Starting Project Deployment...');

    // Create S3 and Insert Objects
    await createS3Bucket();
    await uploadImagesToS3();

    // Create DynamoDB and Insert Items
    await createDynamoDBTable();
    await insertShipsData();

    // Create API Gateway and Configure S3 / DynamoDB Integration
    await createAPIGateway();

    console.log('Project deployed successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Create S3 bucket
 */
async function createS3Bucket() {
  try {
    console.log(`Creating S3 bucket: ${BUCKET_NAME}...`);
    await s3Client.send(
      new CreateBucketCommand({
        Bucket: BUCKET_NAME,
        CreateBucketConfiguration: {
          LocationConstraint: REGION,
        },
      })
    );
    console.log(`Bucket ${BUCKET_NAME} created successfully`);
  } catch (error: any) {
    if (error.name === 'BucketAlreadyOwnedByYou') {
      console.log(`WARNING: Bucket ${BUCKET_NAME} already exists`);
    } else {
      throw error;
    }
  }
}

/**
 * Upload images from assets folder to S3
 */
async function uploadImagesToS3() {
  console.log('Uploading images to S3...');
  
  const assetsDir = path.join(__dirname, '..', 'assets');
  const images = [
    { file: 'fisher.jpg', key: 'pecheur-b-001.jpg' },
    { file: 'tanker.jpg', key: 'tanker-b-002.jpg' },
  ];

  for (const image of images) {
    const filePath = path.join(assetsDir, image.file);
    const fileContent = fs.readFileSync(filePath);
    
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: image.key,
        Body: fileContent,
        ContentType: 'image/jpeg',
      })
    );
    console.log(`Uploaded ${image.file} as ${image.key}`);
  }
}

/**
 * Create DynamoDB table
 */
async function createDynamoDBTable() {
  try {
    console.log(`Creating DynamoDB table: ${TABLE_NAME}...`);
    await dynamoDBClient.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH',
          },
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'S',
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      })
    );
    console.log(`Table ${TABLE_NAME} created successfully`);
    
    // Wait for table to be active
    console.log('Waiting for table to be active...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  } catch (error: any) {
    if (error.name === 'ResourceInUseException') {
      console.log(`WARNING: Table ${TABLE_NAME} already exists`);
    } else {
      throw error;
    }
  }
}

/**
 * Insert ships data into DynamoDB
 */
async function insertShipsData() {
  console.log('Inserting ships data into DynamoDB...');
  
  const dataPath = path.join(__dirname, '..', 'data', 'ships.json');
  const shipsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  for (const ship of shipsData) {
    await dynamoDBClient.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: ship,
      })
    );
    console.log(`Inserted ship: ${ship.nom.S}`);
  }
}

/**
 * Create API Gateway and configure integrations
 */
async function createAPIGateway() {
  console.log('Creating API Gateway...');
  
  // Create REST API
  const createApiResponse = await apiGatewayClient.send(
    new CreateRestApiCommand({
      name: API_NAME,
      description: 'Ships API for Capstone Project',
      endpointConfiguration: {
        types: ['REGIONAL'],
      },
    })
  );
  
  const apiId = createApiResponse.id!;
  console.log(`API Gateway created with ID: ${apiId}`);

  // Get root resource
  const resourcesResponse = await apiGatewayClient.send(
    new GetResourcesCommand({ restApiId: apiId })
  );
  if (!resourcesResponse.items || resourcesResponse.items.length === 0) {
    throw new Error('No root resource found');
  }
  const rootResource = resourcesResponse.items[0];
  if (!rootResource?.id) {
    throw new Error('Root resource ID is undefined');
  }
  const rootResourceId = rootResource.id;

  // Get IAM role ARNs
  console.log('Retrieving IAM role ARNs...');
  // Note: These roles should already exist as per README
  const dynamoDBRoleArn = await getRoleArn('APIGatewayDynamoDBServiceRole');
  const s3RoleArn = await getRoleArn('APIGatewayS3ServiceRole');

  // Create /ships resource
  const shipsResource = await apiGatewayClient.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId: rootResourceId,
      pathPart: 'ships',
    })
  );
  const shipsResourceId = shipsResource.id!;
  console.log(`Created /ships resource`);

  // Create /ships/profile resource
  const profileResource = await apiGatewayClient.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId: shipsResourceId,
      pathPart: 'profile',
    })
  );
  const profileResourceId = profileResource.id!;

  // Create /ships/profile/{key} resource
  const profileKeyResource = await apiGatewayClient.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId: profileResourceId,
      pathPart: '{key}',
    })
  );
  const profileKeyResourceId = profileKeyResource.id!;
  console.log(`Created /ships/profile/{key} resource`);

  // Create /ships/photo resource
  const photoResource = await apiGatewayClient.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId: shipsResourceId,
      pathPart: 'photo',
    })
  );
  const photoResourceId = photoResource.id!;

  // Create /ships/photo/{key} resource
  const photoKeyResource = await apiGatewayClient.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId: photoResourceId,
      pathPart: '{key}',
    })
  );
  const photoKeyResourceId = photoKeyResource.id!;
  console.log(`Created /ships/photo/{key} resource`);

  // Configure endpoints
  await configureGetShipsEndpoint(apiId, shipsResourceId, dynamoDBRoleArn);
  await configureGetProfileEndpoint(apiId, profileKeyResourceId, dynamoDBRoleArn);
  await configureGetPhotoEndpoint(apiId, photoKeyResourceId, s3RoleArn);

  // Enable CORS on all resources
  await enableCORS(apiId, shipsResourceId);
  await enableCORS(apiId, profileKeyResourceId);
  await enableCORS(apiId, photoKeyResourceId);

  // Deploy API
  console.log('Deploying API...');
  await apiGatewayClient.send(
    new CreateDeploymentCommand({
      restApiId: apiId,
      stageName: 'dev',
    })
  );

  // Create API Key and Usage Plan
  const apiKeyId = await createAPIKey(API_NAME);
  await createUsagePlan(apiId, 'dev', apiKeyId);

  const apiUrl = `https://${apiId}.execute-api.${REGION}.amazonaws.com/dev`;
  console.log(`API deployed successfully!`);
  console.log(`API URL: ${apiUrl}`);
  console.log(`\nTest your API with the checker:`);
  console.log(`   Open checker/index.html and paste this URL: ${apiUrl}`);
  console.log(`\nWARNING: Copy the API Key value above to use in your requests!`);
}

/**
 * Configure GET /ships endpoint
 */
async function configureGetShipsEndpoint(
  apiId: string,
  resourceId: string,
  roleArn: string
) {
  console.log('Configuring GET /ships endpoint...');

  // Create GET method
  await apiGatewayClient.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      authorizationType: 'NONE',
      apiKeyRequired: true,
    })
  );

  // Create integration with DynamoDB
  await apiGatewayClient.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      type: 'AWS',
      integrationHttpMethod: 'POST',
      uri: `arn:aws:apigateway:${REGION}:dynamodb:action/Scan`,
      credentials: roleArn,
      requestTemplates: {
        'application/json': JSON.stringify({
          TableName: TABLE_NAME,
        }),
      },
    })
  );

  // Create method response
  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': false,
      },
    })
  );

  // Create integration response
  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
      responseTemplates: {
        'application/json': `#set($inputRoot = $input.path('$'))
{
  "ships": [
    #foreach($item in $inputRoot.Items)
    {
      "id": "$item.id.S",
      "nom": "$item.nom.S",
      "type": "$item.type.S",
      "pavillon": "$item.pavillon.S",
      "taille": $item.taille.N,
      "nombre_marins": $item.nombre_marins.N,
      "s3_image_key": "$item.s3_image_key.S"
    }#if($foreach.hasNext),#end
    #end
  ]
}`,
      },
    })
  );

  console.log('GET /ships endpoint configured');
}

/**
 * Configure GET /ships/profile/{key} endpoint
 */
async function configureGetProfileEndpoint(
  apiId: string,
  resourceId: string,
  roleArn: string
) {
  console.log('Configuring GET /ships/profile/{key} endpoint...');

  // Create GET method
  await apiGatewayClient.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      authorizationType: 'NONE',
      apiKeyRequired: true,
      requestParameters: {
        'method.request.path.key': true,
      },
    })
  );

  // Create integration with DynamoDB
  await apiGatewayClient.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      type: 'AWS',
      integrationHttpMethod: 'POST',
      uri: `arn:aws:apigateway:${REGION}:dynamodb:action/GetItem`,
      credentials: roleArn,
      requestParameters: {
        'integration.request.path.key': 'method.request.path.key',
      },
      requestTemplates: {
        'application/json': `{
  "TableName": "${TABLE_NAME}",
  "Key": {
    "id": {
      "S": "$input.params('key')"
    }
  }
}`,
      },
    })
  );

  // Create method response
  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': false,
      },
    })
  );

  // Create integration response
  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
      responseTemplates: {
        'application/json': `#set($inputRoot = $input.path('$'))
{
  "id": "$inputRoot.Item.id.S",
  "nom": "$inputRoot.Item.nom.S",
  "type": "$inputRoot.Item.type.S",
  "pavillon": "$inputRoot.Item.pavillon.S",
  "taille": $inputRoot.Item.taille.N,
  "nombre_marins": $inputRoot.Item.nombre_marins.N,
  "s3_image_key": "$inputRoot.Item.s3_image_key.S"
}`,
      },
    })
  );

  console.log('GET /ships/profile/{key} endpoint configured');
}

/**
 * Configure GET /ships/photo/{key} endpoint
 */
async function configureGetPhotoEndpoint(
  apiId: string,
  resourceId: string,
  roleArn: string
) {
  console.log('Configuring GET /ships/photo/{key} endpoint...');

  // Create GET method
  await apiGatewayClient.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      authorizationType: 'NONE',
      apiKeyRequired: true,
      requestParameters: {
        'method.request.path.key': true,
      },
    })
  );

  // Create integration with S3
  await apiGatewayClient.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      type: 'AWS',
      integrationHttpMethod: 'GET',
      uri: `arn:aws:apigateway:${REGION}:s3:path/${BUCKET_NAME}/{key}`,
      credentials: roleArn,
      requestParameters: {
        'integration.request.path.key': 'method.request.path.key',
      },
    })
  );

  // Create method response
  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Content-Type': false,
        'method.response.header.Access-Control-Allow-Origin': false,
      },
    })
  );

  // Create integration response
  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Content-Type': 'integration.response.header.Content-Type',
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
    })
  );

  console.log('GET /ships/photo/{key} endpoint configured');
}

/**
 * Enable CORS on a resource
 */
async function enableCORS(apiId: string, resourceId: string) {
  // Create OPTIONS method
  await apiGatewayClient.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'OPTIONS',
      authorizationType: 'NONE',
    })
  );

  // Create MOCK integration
  await apiGatewayClient.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'OPTIONS',
      type: 'MOCK',
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    })
  );

  // Create method response
  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'OPTIONS',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': false,
        'method.response.header.Access-Control-Allow-Methods': false,
        'method.response.header.Access-Control-Allow-Origin': false,
      },
    })
  );

  // Create integration response
  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'OPTIONS',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers':
          "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
        'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
    })
  );
}

/**
 * Create API Key
 */
async function createAPIKey(apiName: string): Promise<string> {
  console.log('Creating API Key...');
  const response = await apiGatewayClient.send(
    new CreateApiKeyCommand({
      name: `${apiName}-key`,
      description: `API Key for ${apiName}`,
      enabled: true,
    })
  );
  console.log(`API Key created: ${response.id}`);
  console.log(`API Key Value: ${response.value}`);
  return response.id!;
}

/**
 * Create Usage Plan and associate API Key
 */
async function createUsagePlan(
  apiId: string,
  stageName: string,
  apiKeyId: string
): Promise<void> {
  console.log('Creating Usage Plan...');
  
  // Create usage plan
  const usagePlanResponse = await apiGatewayClient.send(
    new CreateUsagePlanCommand({
      name: 'ShipsAPI-UsagePlan',
      description: 'Usage plan for Ships API',
      apiStages: [
        {
          apiId: apiId,
          stage: stageName,
        },
      ],
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
      quota: {
        limit: 10000,
        period: 'MONTH',
      },
    })
  );

  console.log(`Usage Plan created: ${usagePlanResponse.id}`);

  // Associate API key with usage plan
  await apiGatewayClient.send(
    new CreateUsagePlanKeyCommand({
      usagePlanId: usagePlanResponse.id!,
      keyId: apiKeyId,
      keyType: 'API_KEY',
    })
  );

  console.log(`API Key associated with Usage Plan`);
}


// Execute the main function
deploy();
