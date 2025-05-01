#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Configuration object for different networks
const networks = {
  'optimism-mainnet': {
    chainId: 10,
    prizePoolAddress: '0xf35fe10ffd0a9672d0095c435fd8767a7fe29b55',
    contractJsonUrl: 'https://raw.githubusercontent.com/GenerationSoftware/pt-v5-mainnet/396f04daedc5a38935460ddf47d2f10e9ac1fec6/deployments/optimism/contracts.json',
    subgraphUrl: 'https://api.studio.thegraph.com/query/63100/pt-v5-optimism/version/latest/graphql',
    rpcEnvVar: 'OPTIMISM_MAINNET_RPC_URL'
  },
  'base-mainnet': {
    chainId: 8453,
    prizePoolAddress: '0x45b2010d8A4f08b53c9fa7544C51dFd9733732cb',
    contractJsonUrl: 'https://raw.githubusercontent.com/GenerationSoftware/pt-v5-mainnet/bc84c3f5e1d9703372ae7f9baf584bab42f47b27/deployments/base/contracts.json',
    subgraphUrl: 'https://subgraph.satsuma-prod.com/17063947abe2/g9-software-inc--666267/pt-v5-base/version/v0.0.1/api',
    rpcEnvVar: 'BASE_MAINNET_RPC_URL'
  },
  'gnosis-mainnet': {
    chainId: 100,
    prizePoolAddress: '0x0c08c2999e1a14569554eddbcda9da5e1918120f',
    contractJsonUrl: 'https://raw.githubusercontent.com/GenerationSoftware/pt-v5-mainnet/196aa20f4a0b3e651d0504ffeb0e1b9a08c7ccb6/deployments/gnosis/contracts.json',
    subgraphUrl: 'https://api.studio.thegraph.com/query/63100/pt-v5-gnosis/version/latest/graphql',
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    rpcEnvVar: 'GNOSIS_MAINNET_RPC_URL'
  },
  'world-mainnet': {
    chainId: 480,
    prizePoolAddress: '0x99ffb0a6c0cd543861c8de84dd40e059fd867dcf',
    contractJsonUrl: 'https://raw.githubusercontent.com/GenerationSoftware/pt-v5-mainnet/8e1432b70c1f135966c1b70917675cd586dda7be/deployments/world/contracts.json',
    subgraphUrl: 'https://api.goldsky.com/api/public/project_cm3xb1e8iup5601yx9mt5caat/subgraphs/pt-v5-world/v0.0.1/gn',
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    rpcEnvVar: 'WORLD_MAINNET_RPC_URL'
  }
};

// CLI version and constants
const CLI_VERSION = '2.0.8';
const OUTPUT_DIRECTORY_NAME = 'winners/vaultAccounts';
const PRIZE_TIERS_TO_COMPUTE = '0,1,2,3,4,5';

// Parse command line arguments
const args = process.argv.slice(2);
const networkArg = args[0];

if (!networkArg || !networks[networkArg]) {
  console.log('Available networks:');
  Object.keys(networks).forEach(net => console.log(`  - ${net}`));
  console.log('\nUsage: node run-local.js <network-name>');
  console.log('Example: node run-local.js ethereum-mainnet');
  process.exit(1);
}

const network = networks[networkArg];

// Check if RPC URL is set
const rpcUrl = process.env[network.rpcEnvVar];
if (!rpcUrl) {
  console.error(`Error: ${network.rpcEnvVar} environment variable is not set.`);
  console.error(`Please set it using: export ${network.rpcEnvVar}=<your-rpc-url>`);
  process.exit(1);
}

// Ensure the output directory exists
const outputDir = path.join(__dirname, OUTPUT_DIRECTORY_NAME);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Retry logic
const MAX_RETRIES = 50;
let attempt = 0;

while (attempt < MAX_RETRIES) {
  attempt++;
  console.log(`Attempt ${attempt}/${MAX_RETRIES}: Running PoolTogether V5 CLI for ${networkArg}...`);
  try {
    // Check if CLI is installed
    try {
      execSync('ptv5 --version', { stdio: 'inherit' });
    } catch (err) {
      console.log(`Installing PoolTogether V5 CLI version ${CLI_VERSION}...`);
      execSync(`npm install -g @generationsoftware/pt-v5-cli@${CLI_VERSION}`, { stdio: 'inherit' });
    }

    // Set remote status URL 
    const remoteStatusUrl = `https://raw.githubusercontent.com/GenerationSoftware/pt-v5-winners/refs/heads/main/winners/vaultAccounts`;

    // Run the command to compute winners
    const command = `ptv5 utils compileWinners \
      -o ./${OUTPUT_DIRECTORY_NAME} \
      -p ${network.prizePoolAddress} \
      -c ${network.chainId} \
      -j ${network.contractJsonUrl} \
      -s ${network.subgraphUrl} \
      -r ${remoteStatusUrl} \
      -m ${network.multicallAddress}`;

    console.log(`Executing command: ${command}`);
    execSync(command, {
      stdio: 'inherit',
      env: {
        ...process.env,
        JSON_RPC_URL: rpcUrl,
        NODE_OPTIONS: '--max_old_space_size=32768',
        PRIZE_TIERS_TO_COMPUTE: PRIZE_TIERS_TO_COMPUTE,
        DEBUG: true
      }
    });

    console.log(`\nSuccessfully computed winners for ${networkArg}!`);
    console.log(`Results saved to ./${OUTPUT_DIRECTORY_NAME}/${network.chainId}/`);
    break;
  } catch (error) {
    console.error(`Attempt ${attempt} failed:`, error.message);
    if (attempt >= MAX_RETRIES) {
      console.error(`Exceeded maximum retries (${MAX_RETRIES}). Exiting.`);
      process.exit(1);
    }
    console.log('Retrying...');
  }
}
