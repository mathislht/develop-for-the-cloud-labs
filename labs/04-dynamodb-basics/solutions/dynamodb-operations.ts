// Import the DynamoDB client and commands
import {
  DynamoDBClient,
  CreateTableCommand,
  PutItemCommand,
  ScanCommand,
  DeleteTableCommand,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';

// Create DynamoDB client instance
const dynamoClient = new DynamoDBClient({
  region: 'eu-west-1',
  // AWS SDK will automatically use AWS SSO credentials
});

// Define the table name with a unique suffix
const tableName = `coffee-shop-${Date.now()}`;

// Function to create the DynamoDB table
async function createTable(): Promise<void> {
  console.log(`📋 Creating table: ${tableName}`);

  const createTableParams = {
    TableName: tableName,
    KeySchema: [
      {
        AttributeName: 'id',
        KeyType: 'HASH' as const, // Partition key
      },
    ],
    AttributeDefinitions: [
      {
        AttributeName: 'id',
        AttributeType: 'S' as const, // String
      },
    ],
    BillingMode: 'PAY_PER_REQUEST' as const, // On-demand billing
  };

  try {
    await dynamoClient.send(new CreateTableCommand(createTableParams));
    console.log('⏳ Waiting for table to be created...');

    // Wait for table to be active
    await waitUntilTableExists(
      { client: dynamoClient, maxWaitTime: 60 },
      { TableName: tableName }
    );

    console.log('✅ Table created successfully!');
  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}

// Function to insert coffee items into the table
async function insertCoffeeItems(): Promise<void> {
  console.log('☕ Inserting Starbucks coffee items...');

  const coffeeItems = [
    {
      id: { S: 'coffee-1' },
      name: { S: 'Espresso' },
      size: { S: 'Tall' },
      price: { N: '3.50' },
    },
    {
      id: { S: 'coffee-2' },
      name: { S: 'Latte' },
      size: { S: 'Grande' },
      price: { N: '4.20' },
    },
    {
      id: { S: 'coffee-3' },
      name: { S: 'Cappuccino' },
      size: { S: 'Venti' },
      price: { N: '4.80' },
    },
  ];

  try {
    for (const item of coffeeItems) {
      const putItemParams = {
        TableName: tableName,
        Item: item,
      };

      await dynamoClient.send(new PutItemCommand(putItemParams));
      console.log(
        `✅ Inserted: ${item.name.S} (${item.size.S}) - €${item.price.N}`
      );
    }

    console.log('✅ All coffee items inserted successfully!');
  } catch (error) {
    console.error('❌ Error inserting items:', error);
    throw error;
  }
}

// Function to read and display all items from the table
async function readAllItems(): Promise<void> {
  console.log('📖 Reading all items from the table...');

  try {
    const scanParams = {
      TableName: tableName,
    };

    const result = await dynamoClient.send(new ScanCommand(scanParams));

    if (result.Items && result.Items.length > 0) {
      console.log('\n📋 Coffee Menu:');
      console.log('================');

      result.Items.forEach((item, index) => {
        console.log(
          `${index + 1}. ${item['name']?.S} (${item['size']?.S}) - €${item['price']?.N}`
        );
      });

      console.log(`\n📊 Total items found: ${result.Items.length}`);
    } else {
      console.log('📭 No items found in the table.');
    }
  } catch (error) {
    console.error('❌ Error reading items:', error);
    throw error;
  }
}

// Function to delete the table (cleanup)
async function deleteTable(): Promise<void> {
  console.log(`🗑️  Deleting table: ${tableName}`);

  try {
    await dynamoClient.send(new DeleteTableCommand({ TableName: tableName }));
    console.log('⏳ Waiting for table to be deleted...');

    // Wait for table to be deleted
    await waitUntilTableNotExists(
      { client: dynamoClient, maxWaitTime: 60 },
      { TableName: tableName }
    );

    console.log('✅ Table deleted successfully!');
  } catch (error) {
    console.error('❌ Error deleting table:', error);
    throw error;
  }
}

// Main function to execute all operations
async function main() {
  try {
    console.log('🚀 Starting DynamoDB operations...');
    console.log(
      `🏷️  Using AWS Profile: ${process.env['AWS_PROFILE'] || 'default'}`
    );

    // Create table
    await createTable();

    // Insert 3 Starbucks coffee items
    await insertCoffeeItems();

    // Read and display all items
    await readAllItems();

    // Clean up: delete the table
    await deleteTable();

    console.log('✅ All operations completed successfully!');
    console.log('🎉 Lab 04 - DynamoDB Basics completed!');
  } catch (error) {
    console.error('❌ Error:', error);

    // Attempt cleanup if something went wrong
    try {
      console.log('🧹 Attempting cleanup...');
      await deleteTable();
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
      console.log(
        '⚠️  Please manually delete the table via AWS Console if it exists.'
      );
    }

    process.exit(1);
  }
}

// Execute the main function
main();
