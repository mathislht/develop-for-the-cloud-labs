import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteBucketCommand,
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
  DeleteTableCommand,
} from '@aws-sdk/client-dynamodb';
import {
  APIGatewayClient,
  GetRestApisCommand,
  DeleteRestApiCommand,
} from '@aws-sdk/client-api-gateway';

// Configuration
const REGION = 'eu-west-1';
const BUCKET_NAME = 'ships-capstone-project-bucket';
const TABLE_NAME = 'ShipsTable';
const API_NAME = 'ShipsAPI';

// Initialize AWS clients
const s3Client = new S3Client({ region: REGION });
const dynamoDBClient = new DynamoDBClient({ region: REGION });
const apiGatewayClient = new APIGatewayClient({ region: REGION });

// Main function to execute destructive operation
async function main() {
  try {
    console.log('Starting Project Deletion...');

    // Delete all resources in order
    await deleteAllDynamoDBItems();
    await deleteDynamoDBTable();
    await emptyAndDeleteS3Bucket();
    await deleteAPIGateway();

    console.log('Project deleted successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Delete all items from DynamoDB table
 */
async function deleteAllDynamoDBItems() {
  try {
    console.log(`Deleting all items from table ${TABLE_NAME}...`);

    // Scan all items
    const scanResponse = await dynamoDBClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
      })
    );

    if (!scanResponse.Items || scanResponse.Items.length === 0) {
      console.log('WARNING: No items found in table');
      return;
    }

    // Delete each item
    for (const item of scanResponse.Items) {
      const itemId = item['id'];
      if (!itemId) {
        console.log('WARNING: Skipping item without id');
        continue;
      }
      await dynamoDBClient.send(
        new DeleteItemCommand({
          TableName: TABLE_NAME,
          Key: {
            id: itemId,
          },
        })
      );
      console.log(`Deleted item: ${itemId.S}`);
    }

    console.log(`All items deleted from ${TABLE_NAME}`);
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`WARNING: Table ${TABLE_NAME} does not exist`);
    } else {
      throw error;
    }
  }
}

/**
 * Delete DynamoDB table
 */
async function deleteDynamoDBTable() {
  try {
    console.log(`Deleting DynamoDB table: ${TABLE_NAME}...`);
    await dynamoDBClient.send(
      new DeleteTableCommand({
        TableName: TABLE_NAME,
      })
    );
    console.log(`Table ${TABLE_NAME} deleted successfully`);
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`WARNING: Table ${TABLE_NAME} does not exist`);
    } else {
      throw error;
    }
  }
}

/**
 * Empty and delete S3 bucket
 */
async function emptyAndDeleteS3Bucket() {
  try {
    console.log(`Emptying and deleting S3 bucket: ${BUCKET_NAME}...`);

    // List all objects in the bucket
    const listResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
      })
    );

    // Delete all objects
    if (listResponse.Contents && listResponse.Contents.length > 0) {
      for (const object of listResponse.Contents) {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: object.Key!,
          })
        );
        console.log(`Deleted object: ${object.Key}`);
      }
    } else {
      console.log('WARNING: No objects found in bucket');
    }

    // Delete the bucket
    await s3Client.send(
      new DeleteBucketCommand({
        Bucket: BUCKET_NAME,
      })
    );
    console.log(`Bucket ${BUCKET_NAME} deleted successfully`);
  } catch (error: any) {
    if (error.name === 'NoSuchBucket') {
      console.log(`WARNING: Bucket ${BUCKET_NAME} does not exist`);
    } else {
      throw error;
    }
  }
}

/**
 * Delete API Gateway
 */
async function deleteAPIGateway() {
  try {
    console.log(`Deleting API Gateway: ${API_NAME}...`);

    // Find API by name
    const apisResponse = await apiGatewayClient.send(
      new GetRestApisCommand({})
    );

    const api = apisResponse.items?.find((item) => item.name === API_NAME);

    if (!api) {
      console.log(`WARNING: API ${API_NAME} not found`);
      return;
    }

    // Delete the API
    await apiGatewayClient.send(
      new DeleteRestApiCommand({
        restApiId: api.id!,
      })
    );
    console.log(`API Gateway ${API_NAME} deleted successfully`);
  } catch (error) {
    console.error('Error deleting API Gateway:', error);
    throw error;
  }
}

// Execute the main function
main();

// Export to make this a module and avoid global scope conflicts
export {};
