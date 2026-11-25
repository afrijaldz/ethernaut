import { deployContract, getContractAt } from "./contract";
import { loadContractJson } from "./contractjson";
import { getDeployFile } from "./deployfile";
import { getGasFeeDetails, getNetworkId, getWalletClient } from "./ethutil";
import {
  cacheContract,
  fetchLevelABI,
  restoreContract,
  updateCachedContract,
} from "./contractutil";
import { CORE_CONTRACT_NAMES, ID_TO_NETWORK } from "../constants.js";
import { loadTranslations } from "../utils/translations";

const logger = (text) => {
  console.dir(`<<  ${text.toUpperCase()}  >>`);
};

async function deploySingleContract(
  contractABI,
  gasDetails,
  from,
  { deployParams = [] } = {}
) {
  logger(`Deploying ${contractABI.contractName} contract`);
  return deployContract(contractABI, deployParams, { from, ...gasDetails });
}

const confirmMainnetDeployment = (chainId) => {
  if (
    chainId === 1 ||
    chainId === 1 || // Eth mainnet
    chainId === 137 || // Polygon
    chainId === 10 || // Optmism
    chainId === 42161 || // Arbitrum
    chainId === 56 // Binance
  ) {
    let language = localStorage.getItem("lang");
    const strings = loadTranslations(language);
    const res = window.confirm(strings.confirmMainnetDeploy);
    return res;
  }
  return true;
}

export async function deployAndRegisterLevel(level) {
  try {
    const levelABI = await fetchLevelABI(level);
    const chainId = await getNetworkId();
    if (!confirmMainnetDeployment(chainId)) {
      return false;
    }
    const gasDetails = await getGasFeeDetails(chainId, 10);
    const [from] = await getWalletClient().getAddresses();
    const levelContractAddress = await deploySingleContract(
      levelABI,
      { gas: 10000000, ...gasDetails },
      from
    );

    logger(`Registering ${level.name} level on the ethernaut contract `);
    // -- use the factory to register a new level since it owns the ethernaut contract
    const factoryAddress = restoreContract(chainId)["factory"];
    const factoryJson = await loadContractJson("LocalFactory.sol", "Factory");
    const localFactory = await getContractAt(factoryJson, factoryAddress, { from });
    await localFactory.registerLevel(levelContractAddress.address, gasDetails);
    // -- add this level factory instance to state
    updateCachedContract(level.deployId, levelContractAddress.address, chainId);
    return levelContractAddress;
  } catch (err) {
    console.log(err);
    return false;
    // alert(err.message);
  }
  // return contractAddress;
}

export async function deployAdminContracts() {
  try {
    const chainId = await getNetworkId();
    if (!confirmMainnetDeployment(chainId)) {
      return false;
    }
    const gameData = restoreContract(chainId);

    const gasDetails = await getGasFeeDetails(chainId, 10);
    const [from] = await getWalletClient().getAddresses();

    // -- deploy factory contracts
    const factoryContracts = await deploySingleContract(
      await loadContractJson("LocalFactory.sol", "Factory"),
      { gas: 10000000, ...gasDetails },
      from
    );
    // -- query factory address for ethernaut, proxy, proxyadmin and implementation
    const deployedCoreContracts =
      await Promise.all(
        CORE_CONTRACT_NAMES.map((coreContractName) =>
          factoryContracts[coreContractName]()
        )
      );

    // -- update the game data array with contract values
    CORE_CONTRACT_NAMES.forEach(
      (key, index) => (gameData[key] = deployedCoreContracts[index])
    );
    gameData.factory = factoryContracts.address;
    gameData.owner = from;
    cacheContract(gameData, chainId);

    // -- stop loader (unnecessary since refresh?)
    const deployWindow = document.querySelectorAll(".deploy-window-bg");
    deployWindow[0].style.display = "none";

    // -- refresh page after deploying contracts
    document.location.replace(document.location.origin);
    return true;
  } catch (err) {
    // TODO maybe refresh the page if they fail to deploy the contracts
    console.log(err);
    // alert(err.message); //todo show a notification prompting the user to click something to restart the process
    return false;
  } finally {
    // -- stop the loader
    const elements = document.querySelectorAll(".progress-bar-wrapper");
    elements[0].style.display = "none";
  }
}

export const getDeployData = (networkId) =>
  getDeployFile(ID_TO_NETWORK[networkId]) || restoreContract(networkId);
