import "dotenv/config";
import prompt from "prompt";
import colors from "colors";
import fs from "fs";
import { encodeFunctionData } from "viem";
import {
  createClients,
  deployContract,
  getDeployedContract,
  getScaledGasPrice,
  readContract,
  readStorageSlot,
  sendContractTransaction,
} from "./viem-client.mjs";
import * as constants from "../src/constants.js";
import * as EthernautABI from "../src/contracts/out/Ethernaut.sol/Ethernaut.json" with { type: "json" };
import * as ProxyStatsABI from "../src/contracts/out/ProxyStats.sol/ProxyStats.json" with { type: "json" };
import * as ProxyAdminABI from "../src/contracts/out/ProxyAdmin.sol/ProxyAdmin.json" with { type: "json" };
import * as ImplementationABI from "../src/contracts/out/Statistics.sol/Statistics.json" with { type: "json" };
import * as SupersederImplementationABI from "../src/contracts/out/StatisticsLevelSuperseder.sol/StatisticsLevelSuperseder.json" with { type: "json" };

import gamedata from "../src/gamedata/gamedata.json" with { type: "json" };
const levels = gamedata.levels;

// For testing purposes in a local fork uncomment one of the following lines to get forked network deployment data.
// const DEPLOY_DATA_PATH = `./client/src/gamedata/deploy.${constants.NETWORKS.GOERLI.name}.json`;
// const DEPLOY_DATA_PATH = `./client/src/gamedata/deploy.${constants.NETWORKS.MUMBAI.name}.json`;
// const DEPLOY_DATA_PATH = `./client/src/gamedata/deploy.${constants.NETWORKS.BASE_SEPOLIA.name}.json`;
// const DEPLOY_DATA_PATH = `./client/src/gamedata/deploy.${constants.NETWORKS.OPTIMISM_GOERLI.name}.json`;
// const DEPLOY_DATA_PATH = `./client/src/gamedata/deploy.${constants.NETWORKS.ARBITRUM_GOERLI.name}.json`;
// const DEPLOY_DATA_PATH = `./client/src/gamedata/deploy.local.json`;

// For real purposes
const DEPLOY_DATA_PATH = `./client/src/gamedata/deploy.${constants.ACTIVE_NETWORK.name}.json`;

const DeployData = await loadDeployData(DEPLOY_DATA_PATH);
// Operator address, the account that will perform the data dump (meant to be ethernaut owner).
const OPERATOR_ADDRESS = constants.ADDRESSES[`${constants.ACTIVE_NETWORK.name}`];

// Contract Objects
let clients;
let ethernaut;
let proxyStats;
let proxyStatsWithImplementationABI;
let proxyStatsWithSupersederImplementationABI;
let proxyAdmin;
let statsSupersederImplementation;

// Dump stages enum
const DumpStage = {
  INIT: 0,
  SET_ADDRESSES: 1,
  LEVEL_FIRST_INSTANCE_CREATION_TIME: 2,
  LEVEL_FIRST_COMPLETION_TIME: 3,
  PLAYER_STATS: 4,
  LEVEL_STATS: 5,
  LEVEL_EXISTS_AND_LEVELS_ARRAY_FIX: 6,
  DUMP_DONE: 7,
};


async function supersede() {
  let oldAddress;
  let newAddress;
  // check if there is a pending process
  
  if (await isOnMaintenance()) {
    console.log(colors.bold.red("Pending level replacement detected, resuming..."));
    oldAddress = await readSuperseder("oldLevelContractAddress");
    newAddress = await readSuperseder("newLevelContractAddress");
    console.log(
      colors.grey(
        ` DumpStage: ${
          await readSuperseder("dumpStage")
        }`
      )
    );
    console.log(colors.gray(` From: ${oldAddress}`));
    console.log(colors.gray(` To: ${newAddress}`));
  } else {
    // Print available levels list
    console.log(
      colors.bold.yellow(
        "\nOpenZeppelin-Ethernaut contract level replacement tool, available levels:\n"
      )
    );
    levels.forEach((level) => {
      console.log(` ${colors.red(level.deployId)}) ${colors.cyan(level.name)}`);
    });

    // Get operator's level choice
    console.log(colors.bold.yellow("\nWhich deployId do you want to supersede?"));
    const LevelToBeSupersededData = await getLevelToBeSupersededData();
    // Check if level is registered into ethernaut and is not already superseded
    if (!(await isLevelRegistered(LevelToBeSupersededData))) {
      console.log(colors.bold.red("Level is not registered in Ethernaut"));
      process.exit();
    }
    if (!(await doesLevelExistsInStatistics(LevelToBeSupersededData))) {
      console.log(colors.bold.red("Level is already superseded"));
      process.exit();
    }

    // Print level info
    await printLevelInfo(LevelToBeSupersededData);

    // Confirm substitution by operator
    console.log(colors.bold.yellow("\nConfirm substitution?"));
    if (!(await operatorConfirmation(LevelToBeSupersededData))) {
      console.log(colors.bold.red("Substitution not confirmed by operator"));
      process.exit();
    }
 
    // Upgrade Statistics
    await deployAndUpgradeStatisticsToStatisticsSuperseder();

    // Deploy new version const newLevelContract
    const newLevelContract = await deployLevel(LevelToBeSupersededData);

    // Update deploy data object
    const ret = storeSubstitutionInDeployData(newLevelContract, LevelToBeSupersededData);

    oldAddress = ret.oldAddress;
    newAddress = ret.newAddress;

   // Register new address in ethernaut
    await registerLevelInEthernaut(newAddress, LevelToBeSupersededData);

    // Set replacement addresses
    await setSubstitutionAddresses(oldAddress, newAddress);
  }
  // Dump Statistics data
  await dumpData();
  
  // Clean used storage slots
  await cleanStorage();
  
  // Print edited storage slots
  await printEditedStorageSlots(oldAddress, newAddress);
  
  // Downgrade Statistics
  await downgradeStatisticsSupersederToStatisticsAndSaveDeployData();

  process.exit();
}

prompt.start();
clients = createClients(constants.ACTIVE_NETWORK);
await loadGameContracts();
await supersede();

// onMaintenance is the only variable in storage slot 17 of StatisticsLevelSuperseder.
async function isOnMaintenance() {
  return (await readStorageSlot(clients, proxyStats.address, 17n)) === 1n;
}

function readSuperseder(functionName, args) {
  return readContract(clients, proxyStatsWithSupersederImplementationABI, functionName, args);
}

function sendToSuperseder(functionName, args, props) {
  return sendContractTransaction(
    clients,
    proxyStatsWithSupersederImplementationABI,
    functionName,
    args,
    props
  );
}

async function getLevelToBeSupersededData() {
  const options = {
    properties: {
      deployId: {
        description: "deployId",
        required: true,
      },
    },
  };

  const { deployId } = await prompt.get(options);
  if (deployId >= levels.length || deployId < 0) {
    console.log(colors.bold.red("deployId entered must be in the list"));
    process.exit();
  }

  return levels[deployId];
}

async function isLevelRegistered(level) {
  const levelAddress = DeployData[level.deployId];
  return await readContract(clients, ethernaut, "registeredLevels", [levelAddress]);
}

async function doesLevelExistsInStatistics(level) {
  const levelAddress = DeployData[level.deployId];
  return await readContract(
    clients,
    proxyStatsWithImplementationABI,
    "doesLevelExist",
    [levelAddress]
  );
}

async function printLevelInfo(level) {
  const levelAddress = DeployData[level.deployId];
  const FailedSubmissions = await readContract(
    clients,
    proxyStatsWithImplementationABI,
    "getNoOfFailedSubmissionsForLevel",
    [levelAddress]
  );
  const CompletedSubmissions = await readContract(
    clients,
    proxyStatsWithImplementationABI,
    "getNoOfCompletedSubmissionsForLevel",
    [levelAddress]
  );
  const InstancesForLevel = await readContract(
    clients,
    proxyStatsWithImplementationABI,
    "getNoOfInstancesForLevel",
    [levelAddress]
  );

  console.log(colors.bold.yellow(`\nSelected level data:`));
  console.log(` Network: ${colors.green(constants.ACTIVE_NETWORK.name)}`);
  console.log(` Name: ${colors.green(level.name)}`);
  console.log(` Address: ${colors.green(levelAddress)}`);
  console.log(` Failed submissions: ${colors.green(FailedSubmissions.toString())}`);
  console.log(` Completed submissions: ${colors.green(CompletedSubmissions.toString())}`);
  console.log(` Instances: ${colors.green(InstancesForLevel.toString())}`);
}

async function deployAndUpgradeStatisticsToStatisticsSuperseder() {
  console.log(colors.bold.yellow("\nDeploying and Upgrading statistics contract to statisticsSuperseder..."));

  const props = {
    gasPrice: await getScaledGasPrice(clients, 110n),
    gas: 30000000n,
  };

  // Deploy SupersederImplementation
  console.log(colors.grey(` Deploying StatisticsLevelSuperseder.sol...`));
  statsSupersederImplementation = await deployContract(
    clients,
    SupersederImplementationABI.default,
    [],
    props
  );
  console.log(colors.grey(" Done!"), "✅");
  console.log(` SupersederImplementation: ${statsSupersederImplementation.address}`);

  // Upgrade and set operator and on maintenance flag
  const initEncodedCall = encodeFunctionData({
    abi: SupersederImplementationABI.default.abi,
    functionName: "setOperator",
    args: [OPERATOR_ADDRESS],
  });

  console.log(colors.grey(` Upgrading Proxy...`));
  await sendContractTransaction(
    clients,
    proxyAdmin,
    "upgradeAndCall",
    [proxyStats.address, statsSupersederImplementation.address, initEncodedCall],
    props
  );
  console.log(colors.grey(` Proxy is upgraded! ✅`));

  // Check if onMaintenance is true
  if (!(await isOnMaintenance())) {
    console.log(colors.bold.red("Error onMaintenance not set"));
    process.exit();
  }
}

async function deployLevel(level) {
  console.log(
    colors.bold.yellow(`\nDeploying ${level.levelContract}, deployId: ${level.deployId}...`)
  );

  const LevelABI = JSON.parse(
    fs.readFileSync(
      `contracts/out/${level.levelContract}/${
        level.levelContract.split(".")[0]
      }.json`,
      "utf-8"
    )
  );

  const props = {
    gasPrice: await getScaledGasPrice(clients, 110n),
    gas: 4500000n,
  };

  const newLevelContract = await deployContract(clients, LevelABI, level.deployParams, props);
  console.log(colors.grey(" Done!"), "✅");
  console.log(" new Address:", colors.bold.green(`${newLevelContract.address}`));

  return newLevelContract;
}

function storeSubstitutionInDeployData(newLevelContract, level) {
  console.log(colors.gray(` Registering operation in ${DEPLOY_DATA_PATH}`));
  console.log(colors.gray(` ${DeployData[level.deployId]} --> ${newLevelContract.address}`));

  if (!DeployData.supersededAddresses) {
    DeployData.supersededAddresses = [];
  }

  const i = DeployData.supersededAddresses.push({
    oldAddress: DeployData[level.deployId],
    newAddress: newLevelContract.address,
  });

  DeployData[level.deployId] = newLevelContract.address;
  DeployData.implementation = statsSupersederImplementation.address;

  storeDeployData(DEPLOY_DATA_PATH);
  return DeployData.supersededAddresses[i - 1];
}

async function registerLevelInEthernaut(newAddress, level) {
  console.log(colors.bold.yellow("\nRegistering level in Ethernaut contract..."));

  const props = {
    gasPrice: await getScaledGasPrice(clients, 110n),
    gas: 450000n,
  };

  await sendContractTransaction(clients, ethernaut, "registerLevel", [newAddress], props);
  //Check
  if (!(await isLevelRegistered(level))) {
    console.log(colors.bold.red("New address level not registered in Ethernaut"));
    process.exit();
  }
  if (!(await doesLevelExistsInStatistics(level))) {
    console.log(colors.bold.red("New address level not registered in Statistics"));
    process.exit();
  }
  console.log(colors.grey(" Done!"), "✅");
}

async function setSubstitutionAddresses(oldAddress, newAddress) {
  // Set substitution level addresses
  console.log(colors.grey(" Setting substitution addresses in StatisticsLevelSuperseder..."));

  const props = {
    gasPrice: await getScaledGasPrice(clients, 110n),
    gas: 450000n,
  };
  await sendToSuperseder("setSubstitutionAddresses", [oldAddress, newAddress], props);

  // Check that addresses are correct
  const oldAddressFromContract = await readSuperseder("oldLevelContractAddress");
  if (oldAddress != oldAddressFromContract) {
    console.log(colors.bold.red("Old address is not set correctly"));
    process.exit();
  }

  const newAddressFromContract = await readSuperseder("newLevelContractAddress");
  if (newAddress != newAddressFromContract) {
    console.log(colors.bold.red("New address is not set correctly"));
    process.exit();
  }
  console.log(colors.grey(" Done!"), "✅");
}

async function dumpData() {
  console.log(colors.bold.yellow("\nDumping statistics data..."));

  const props = { // gas can be tuned here
    gasPrice: await getScaledGasPrice(clients, 110n),
    gas: 4000000n, 
  };
  let dumpStage;
  do {
    dumpStage = await readSuperseder("dumpStage");

    switch (dumpStage) {
      case DumpStage.SET_ADDRESSES: //1
      case DumpStage.LEVEL_FIRST_INSTANCE_CREATION_TIME: //2
        // Dump LevelFirstInstanceCreationTime
        console.log(colors.grey(" Dumping LevelFirstInstanceCreationTime"));

        do {
          console.log(
            colors.grey(
              " Dumped ",
              await readSuperseder("usersArrayIndex"),
              "Players"
            )
          );

          await sendToSuperseder("dumpLevelFirstInstanceCreationTime", [], props);
          dumpStage = await readSuperseder("dumpStage");
        } while (dumpStage != DumpStage.LEVEL_FIRST_COMPLETION_TIME);

        console.log(colors.grey(" Done!"), "✅");
        break;

      case DumpStage.LEVEL_FIRST_COMPLETION_TIME: //3
        // Dump levelFirstCompletionTime
        console.log(colors.grey(" Dumping levelFirstCompletionTime"));

        do {
          console.log(
            colors.grey(
              " Dumped ",
              await readSuperseder("usersArrayIndex"),
              "Players"
            )
          );

          await sendToSuperseder("dumpLevelFirstCompletionTime", [], props);

          dumpStage = await readSuperseder("dumpStage");
        } while (dumpStage != DumpStage.PLAYER_STATS);
        console.log(colors.grey(" Done!"), "✅");
        break;

      case DumpStage.PLAYER_STATS: //4
        // Dump playerStats
        console.log(colors.grey(" Dumping playerStats"));

        do {
          console.log(
            colors.grey(
              " Dumped ",
              await readSuperseder("usersArrayIndex"),
              "Players"
            )
          );
          await sendToSuperseder("dumpPlayerStats", [], props);

          dumpStage = await readSuperseder("dumpStage");
        } while (dumpStage != DumpStage.LEVEL_STATS);
        console.log(colors.grey(" Done!"), "✅");
        break;

      case DumpStage.LEVEL_STATS: //5
        // Dump levelStats
        console.log(colors.grey(" Dumping levelStats"));
        {
          await sendToSuperseder("dumpLevelStats", [], props);
        }
        console.log(colors.grey(" Done!"), "✅");
        break;

      case DumpStage.LEVEL_EXISTS_AND_LEVELS_ARRAY_FIX: //6
        // Fix levelExist mapping and levels array
        console.log(colors.grey(" fixing levelExist mapping and levels array"));
        {
          await sendToSuperseder("fixLevelExistAndLevelsArray", [], props);
        }
        console.log(colors.grey(" Done!"), "✅");

        break;
    }
  } while (dumpStage != DumpStage.DUMP_DONE);
}

async function cleanStorage() {
  console.log(colors.bold.yellow(" Cleaning used storage slots..."));

  const props = {
    gasPrice: await getScaledGasPrice(clients, 110n),
    gas: 450000n,
  };

  await sendToSuperseder("cleanStorage", [], props);
  console.log(colors.grey(" Done!"), "✅");
}

async function printEditedStorageSlots(oldAddress, newAddress) {
  console.log(colors.bold.yellow(" Checking operation..."));
  console.log(`old address: ${oldAddress} new address: ${newAddress}`);
  const totalPlayers = await readSuperseder("getTotalNoOfPlayers");

  let usersArrayIndex = 0n;
  // loop over all users
  while (usersArrayIndex < totalPlayers) {
    let userAddress = await readSuperseder("getPlayerAtIndex", [usersArrayIndex]);

    console.log(
      `old: player ${usersArrayIndex} : ${userAddress}`,
      (
        await readSuperseder("getLevelFirstInstanceCreationTime", [userAddress, oldAddress])
      ).toString()
    );
    usersArrayIndex++;
  }

  usersArrayIndex = 0n;
  // loop over all users
  while (usersArrayIndex < totalPlayers) {
    let userAddress = await readSuperseder("getPlayerAtIndex", [usersArrayIndex]);

    console.log(
      `new: player ${usersArrayIndex} : ${userAddress}`,
      (
        await readSuperseder("getLevelFirstInstanceCreationTime", [userAddress, newAddress])
      ).toString()
    );
    usersArrayIndex++;
  }

  console.log("-------------------------------------------------");
  
  usersArrayIndex = 0n;
  // loop over all users
  while (usersArrayIndex < totalPlayers) {
    let userAddress = await readSuperseder("getPlayerAtIndex", [usersArrayIndex]);

    console.log(
      `old: player ${usersArrayIndex} : ${userAddress}`,
      (await readSuperseder("getLevelFirstCompletionTime", [userAddress, oldAddress])).toString()
    );
    usersArrayIndex++;
  }

  usersArrayIndex = 0n;
  // loop over all users
  while (usersArrayIndex < totalPlayers) {
    let userAddress = await readSuperseder("getPlayerAtIndex", [usersArrayIndex]);

    console.log(
      `new: player ${usersArrayIndex} : ${userAddress}`,
      (await readSuperseder("getLevelFirstCompletionTime", [userAddress, newAddress])).toString()
    );
    usersArrayIndex++;
  }

  console.log("-------------------------------------------------");

 usersArrayIndex = 0n;
  // loop over all users
  while (usersArrayIndex < totalPlayers) {
    let userAddress = await readSuperseder("getPlayerAtIndex", [usersArrayIndex]);

    console.log(
      `old: player ${usersArrayIndex} : ${userAddress}`,
      await readSuperseder("getPlayerStats", [userAddress, oldAddress])
    );
    usersArrayIndex++;
  }

  usersArrayIndex = 0n;
  // loop over all users
  while (usersArrayIndex < totalPlayers) {
    let userAddress = await readSuperseder("getPlayerAtIndex", [usersArrayIndex]);

    console.log(
      `new: player ${usersArrayIndex} : ${userAddress}`,
      await readSuperseder("getPlayerStats", [userAddress, newAddress])
    );
    usersArrayIndex++;
  }

  console.log("-------------------------------------------------");
  console.log("Levels stats");

  console.log(
    `LevelStats[${oldAddress}]`,
    await readSuperseder("getLevelStats", [oldAddress])
  );

  console.log(
    `LevelStats[${newAddress}]`,
    await readSuperseder("getLevelStats", [newAddress])
  );

  console.log("-------------------------------------------------");
  console.log("Levels Exist");

  console.log(
    `levelExists[${oldAddress}]`,
    await readSuperseder("getLevelExists", [oldAddress])
  );

  console.log(
    `levelExists[${newAddress}]`,
    await readSuperseder("getLevelExists", [newAddress])
  );

  console.log("-------------------------------------------------");
  console.log("Levels array");
  let levelsArrayLength = await readSuperseder("getTotalNoOfEthernautLevels");
  console.log(`length ${levelsArrayLength}`);
  let arrayIndex = 0n;
  do {
    console.log(
      `arrayIndex: ${arrayIndex}`,
      await readSuperseder("getLevelAddress", [arrayIndex])
    );
    arrayIndex++;
  } while (arrayIndex < levelsArrayLength);
}

async function downgradeStatisticsSupersederToStatisticsAndSaveDeployData() {
  console.log(colors.bold.yellow("\nDowngrading statisticsSuperseder contract to statistics..."));

  const props = {
    gasPrice: await getScaledGasPrice(clients, 110n),
    gas: 450000n,
  };

  // Deploy Implementation
  console.log(colors.grey(` Upgrading Proxy...`));
  await sendContractTransaction(
    clients,
    proxyAdmin,
    "upgrade",
    [
      proxyStats.address,
      "0x7000e0f2f5a389df14b50c6f84686123f19b27f6", // Set original address
    ],
    props
  );

  console.log(colors.grey(` Proxy is downgraded! ✅`));

  DeployData.implementation = "0x7000e0f2f5a389df14b50c6f84686123f19b27f6"; // Set original address
  storeDeployData(DEPLOY_DATA_PATH);
}
async function loadGameContracts() {
  // Ethernaut
  ethernaut = await getDeployedContract(clients, EthernautABI.default, DeployData.ethernaut);

  // Statistics proxy
  proxyStats = await getDeployedContract(clients, ProxyStatsABI.default, DeployData.proxyStats);

  // Statistics proxy with implementation ABI to call functions with proxy state
  proxyStatsWithImplementationABI = await getDeployedContract(
    clients,
    ImplementationABI.default,
    DeployData.proxyStats
  );

  // Statistics proxy with superseder implementation ABI to call functions with proxy state
  proxyStatsWithSupersederImplementationABI = await getDeployedContract(
    clients,
    SupersederImplementationABI.default,
    DeployData.proxyStats
  );

  // Statistics proxy admin
  proxyAdmin = await getDeployedContract(clients, ProxyAdminABI.default, DeployData.proxyAdmin);

  // Statistics implementation, must be deployed
  await getDeployedContract(clients, ImplementationABI.default, DeployData.implementation);
}

function loadDeployData(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (err) {
    return {};
  }
}

function storeDeployData(path) {
  console.log(colors.green(`Writing updated deploy data: ${path}`));
  return fs.writeFileSync(path, JSON.stringify(DeployData, null, 2), "utf8");
}

async function operatorConfirmation() {
  const options = {
    properties: {
      confirmSubstitution: {
        pattern: new RegExp("^[yYnN]$"),
        description: `(y/n)`,
        message: "invalid input",
      },
    },
  };

  const { confirmSubstitution } = await prompt.get(options);
  return confirmSubstitution === "y" || confirmSubstitution === "Y";
}
