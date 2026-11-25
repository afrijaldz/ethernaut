import "dotenv/config";
import prompt from "prompt";
import colors from "colors";
import fs from "fs";
import * as constants from "../src/constants.js";
import {
  createClients,
  deployContract,
  getDeployedContract,
  getScaledGasPrice,
  readContract,
  sendContractTransaction,
} from "./viem-client.mjs";
import * as gamedata from "../src/gamedata/gamedata.json" with { type: "json" };
import * as EthernautABI from "../src/contracts/out/Ethernaut.sol/Ethernaut.json" with { type: "json" };
import * as ProxyAdminABI from "../src/contracts/out/ProxyAdmin.sol/ProxyAdmin.json" with { type: "json" };
import * as ImplementationABI from "../src/contracts/out/Statistics.sol/Statistics.json" with { type: "json" };
import * as ProxyStatsABI from "../src/contracts/out/ProxyStats.sol/ProxyStats.json" with { type: "json" };

let clients;
let ethernaut;
let proxyAdmin;
let implementation;
let proxyStats;

const PROMPT_ON_DEVELOP = true;
const DEPLOY_DATA_PATH = `./client/src/gamedata/deploy.${constants.ACTIVE_NETWORK.name}.json`;

async function exec() {
  console.log(
    colors.cyan(`<< NETWORK: ${constants.ACTIVE_NETWORK.name} >>`).inverse
  );

  clients = createClients(constants.ACTIVE_NETWORK);

  // Retrieve deployment data for the active network.
  const deployData = loadDeployData(DEPLOY_DATA_PATH);
  // Determine which contracts need to be deployed.
  let count = 0;
  if (needsDeploy(deployData.ethernaut)) {
    count++;
    console.log(colors.red(`(${count}) Will deploy Ethernaut.sol!`));
  }
  if (needsDeploy(deployData.implementation)) {
    count++;
    console.log(colors.red(`(${count}) Will deploy Statistics.sol!`));
  }
  if (needsDeploy(deployData.proxyAdmin)) {
    count++;
    console.log(colors.red(`(${count}) Will deploy ProxyAdmin.sol!`));
  }
  if (needsDeploy(deployData.proxyStats)) {
    count++;
    console.log(colors.red(`(${count}) Will deploy ProxyStats.sol!`));
  }
  gamedata.default.levels.map((level) => {
    if (needsDeploy(deployData[level.deployId])) {
      count++;
      console.log(
        colors.cyan(
          `(${count}) Will deploy ${level.levelContract} (${level.name})`
        )
      );
    }
  });

  if (count === 0) {
    console.log(colors.gray(`No actions to perform, exiting.`));
    return;
  }

  if (await confirmDeployment()) {
    await deployContracts(deployData);
    storeDeployData(DEPLOY_DATA_PATH, deployData);
    console.log("Done");
    process.exit();
  }
}

exec();

async function deployContracts(deployData) {
  const props = {
    gasPrice: await getScaledGasPrice(clients, 105n),
    // EIP-7825 (Fusaka) caps one transaction at 2^24 = 16,777,216 gas.
    gas: 16000000n,
  };

  console.log("FROM: ", clients.walletClient.account.address);

  // Deploy/retrieve ethernaut contract
  if (needsDeploy(deployData.ethernaut)) {
    console.log(`Deploying Ethernaut.sol...`);
    ethernaut = await deployContract(clients, EthernautABI.default, [], props);
    console.log(colors.yellow(`  Ethernaut: ${ethernaut.address}`));
    deployData.ethernaut = ethernaut.address;
  } else {
    console.log("Using deployed Ethernaut.sol:", deployData.ethernaut);
    ethernaut = await getDeployedContract(
      clients,
      EthernautABI.default,
      deployData.ethernaut
    );
  }

  // Deploy/retrieve Implementation
  await deployImplementation(props, deployData);

  // Deploy/retrieve Proxy Admin
  await deployProxyAdmin(props, deployData);

  // Deploy/retrieve ProxyStats
  await deployProxyStats(props, deployData);

  // set ProxyStats in Ethernaut
  await setStatProxy(props);

  // Sweep levels one at a time: every transaction comes from the same
  // account, so parallel sends race for the same nonce.
  for (const level of gamedata.default.levels) {
    if (!needsDeploy(deployData[level.deployId])) {
      console.log(`Using deployed ${level.levelContract}...`);
      continue;
    }

    console.log(
      `Deploying ${level.levelContract}, deployId: ${level.deployId}...`
    );

    // Deploy contract
    const LevelABI = JSON.parse(
      fs.readFileSync(
        `contracts/out/${
          level.levelContract
        }/${withoutExtension(level.levelContract)}.json`,
        "utf-8"
      )
    );
    const contract = await deployContract(
      clients,
      LevelABI,
      level.deployParams,
      props
    );
    console.log(colors.yellow(`  ${level.name}: ${contract.address}`));
    deployData[level.deployId] = contract.address;
    console.log(
      colors.gray(
        `  storing deployed id: ${level.deployId} with address: ${contract.address}`
      )
    );

    // Register level in Ethernaut contract
    console.log(
      `  Registering level ${level.levelContract} in Ethernaut.sol...`
    );
    await sendContractTransaction(
      clients,
      ethernaut,
      "registerLevel",
      [contract.address],
      props
    );
    console.log(`Registered ${level.levelContract}!`);
  }
}

// ----------------------------------
// Deployment Functions
// ----------------------------------

async function deployProxyAdmin(props, deployData) {
  if (needsDeploy(deployData.proxyAdmin)) {
    console.log(`Deploying ProxyAdmin.sol...`);
    proxyAdmin = await deployContract(clients, ProxyAdminABI.default, [], props);
    console.log(colors.yellow(`  ProxyAdmin: ${proxyAdmin.address}`));
    deployData.proxyAdmin = proxyAdmin.address;
  } else {
    console.log("Using deployed ProxyAdmin.sol:", deployData.proxyAdmin);
    proxyAdmin = await getDeployedContract(
      clients,
      ProxyAdminABI.default,
      deployData.proxyAdmin
    );
  }
  return proxyAdmin.address;
}

async function deployImplementation(props, deployData) {
  if (needsDeploy(deployData.implementation)) {
    console.log(`Deploying Statistics.sol...`);
    implementation = await deployContract(clients, ImplementationABI.default, [], props);
    console.log(colors.yellow(`  Statistics: ${implementation.address}`));
    deployData.implementation = implementation.address;
  } else {
    console.log("Using deployed Statistics.sol:", deployData.implementation);
    implementation = await getDeployedContract(
      clients,
      ImplementationABI.default,
      deployData.implementation
    );
  }

  return implementation.address;
}

async function deployProxyStats(props, deployData) {
  if (needsDeploy(deployData.proxyStats)) {
    console.log(`Deploying Proxy.sol...`);
    proxyStats = await deployContract(
      clients,
      ProxyStatsABI.default,
      [implementation.address, proxyAdmin.address, ethernaut.address],
      props
    );
    console.log(colors.yellow(`  Proxy: ${proxyStats.address}`));
    deployData.proxyStats = proxyStats.address;
  } else {
    console.log("Using deployed Proxy.sol:", deployData.proxyStats);
    proxyStats = await getDeployedContract(
      clients,
      ProxyStatsABI.default,
      deployData.proxyStats
    );
  }

  return proxyStats.address;
}

// ----------------------------------
// Utils
// ----------------------------------

async function setStatProxy(props) {
  console.log(`Setting proxy in Ethernaut.sol...`);

  const proxyAddress = await readContract(clients, ethernaut, "statistics");
  if (needsSetProxy(proxyAddress)) {
    await sendContractTransaction(
      clients,
      ethernaut,
      "setStatistics",
      [proxyStats.address],
      props
    );
  }
}

function needsSetProxy(proxy) {
  return (
    proxy === undefined ||
    proxy === "0x0000000000000000000000000000000000000000"
  );
}

function withoutExtension(str) {
  return str.split(".")[0];
}

function needsDeploy(deployAddress) {
  if (constants.ACTIVE_NETWORK === constants.NETWORKS.LOCAL) return true;
  return deployAddress === undefined || deployAddress === "x";
}

function loadDeployData(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (err) {
    return {};
  }
}

function storeDeployData(path, deployData) {
  console.log(colors.green(`Writing updated deploy data: ${path}`));
  return fs.writeFileSync(path, JSON.stringify(deployData, null, 2), "utf8");
}

function confirmDeployment() {
  return new Promise((resolve, reject) => {
    if (
      PROMPT_ON_DEVELOP ||
      constants.ACTIVE_NETWORK !== constants.NETWORKS.LOCAL
    ) {
      const options = {
        properties: {
          confirmDeployment: {
            description: `Confirm deployment? (y/n)`,
          },
        },
      };

      prompt.start();
      prompt.get(options, (err, res) => {
        if (err) return reject(err);
        resolve(res.confirmDeployment === "y");
      });
    } else {
      resolve(true);
    }
  });
}
