import 'dotenv/config';
import colors from 'colors';
import fs from 'fs';
import * as constants from '../src/constants.js';
import {
  createClients,
  deployContract,
  getScaledGasPrice,
  sendContractTransaction,
} from './viem-client.mjs';
import * as ProxyAdminABI from '../src/contracts/out/ProxyAdmin.sol/ProxyAdmin.json' with { type: 'json' };
import * as ImplementationABI from '../src/contracts/out/Statistics.sol/Statistics.json' with { type: 'json' };

let clients;

const DEPLOY_DATA_PATH = `./client/src/gamedata/deploy.${constants.ACTIVE_NETWORK.name}.json`;

async function deployImplementation(props) {
  console.log(colors.green(`Deploying Statistics.sol...`));
  const implementation = await deployContract(
    clients,
    ImplementationABI.default,
    [],
    props
  );
  console.log(` Implementation: ${implementation.address}`);
  return implementation.address;
}

async function upgradeTo(props, newImplementation) {
  console.log(colors.green(`Upgrading to new Implementation...`));
  const deployedData = loadDeployData(DEPLOY_DATA_PATH);

  const proxyAdmin = {
    address: deployedData.proxyAdmin,
    abi: ProxyAdminABI.default.abi,
  };

  await sendContractTransaction(
    clients,
    proxyAdmin,
    'upgrade',
    [deployedData.proxyStats, newImplementation],
    props
  );

  console.log(colors.bgBlue(`Proxy is upgraded!`));
}

async function deploy() {
  clients = createClients(constants.ACTIVE_NETWORK);

  const props = {
    gasPrice: await getScaledGasPrice(clients, 1000n),
    gas: 4500000n,
  };

  console.log('FROM: ', clients.walletClient.account.address);

  let impl = await deployImplementation(props);

  await upgradeTo(props, impl);

  let deployData = {
    implementation: impl,
  };

  storeDeployData(DEPLOY_DATA_PATH, deployData);
  console.log('Done');
  process.exit();
}

deploy();

function storeDeployData(path, deployData) {
  console.log(colors.green(`Writing updated deploy data: ${path}`));
  let json = JSON.parse(fs.readFileSync(path));
  Object.assign(json, deployData);
  return fs.writeFileSync(path, JSON.stringify(json), 'utf8');
}

function loadDeployData(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (err) {
    return {};
  }
}
