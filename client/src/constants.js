export const DEBUG = process.env.NODE_ENV !== "production";
export const DEBUG_REDUX = DEBUG;

// Networks for operations
export const NETWORKS = {
  UNDEFINED: undefined,
  LOCAL: {
    name: "local",
    id: "31337",
    url: "http://localhost",
    port: 8545,
  },
  BASE_SEPOLIA: {
    name: "base-sepolia",
    id: "84532",
    url: `${process.env.BASE_SEPOLIA_HOST}`,
    privKey: `${process.env.PRIV_KEY}`,
  },
};

// Networks for operations
export const NETWORKS_INGAME = {
  UNDEFINED: undefined,
  LOCAL: {
    name: "local",
    id: "31337",
    url: "http://localhost",
    port: 8545,
  },
  BASE_SEPOLIA: {
    name: "base-sepolia",
    id: "84532",
    currencyName: "Base-ETH",
    currencySymbol: "ETH",
    rpcUrl: `https://sepolia.base.org`,
    blockExplorer: "https://sepolia.basescan.org",
    explorer: {
      apiKey: `${process.env.REACT_APP_BASE_SEPOLIA_EXPLORER_API_KEY}`,
      apiHost: `https://api-sepolia.basescan.org`,
    },
  },
};

// Deprecated networks
// status: {deprecated | deprecation-planned}
export const NETWORKS_DEPRECATION = {
  GOERLI: {
    id: "5",
    status: "deprecated",
    date: "jan-2024",
  },
  OPTIMISM_GOERLI: {
    id: "420",
    status: "deprecated",
    date: "jan-2024",
  },
  ARBITRUM_GOERLI: {
    id: "421613",
    status: "deprecated",
    date: "jan-2024",
  },
  MUMBAI: {
    id: "80001",
    status: "deprecated",
    date: "april-2024",
  },
};

// Misc
export const CLEAR_CONSOLE = !DEBUG;

// Owner addresses
export const ADDRESSES = {
  [NETWORKS.LOCAL.name]: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  [NETWORKS.BASE_SEPOLIA.name]: "0x467945D438E785e7eDC940717B550b762C45D361",
};

// Support EIP-1559
export const SUPPORTS_EIP_1559 = [
  "5", // NETWORKS.GOERLI.id
  "80001", // NETWORKS.MUMBAI.id
  "11155111", // Sepolia
];

// Core contract keys
export const CORE_CONTRACT_NAMES = [
  "ethernaut",
  "proxyAdmin",
  "implementation",
  "proxyStats",
];

// Storage
export const VERSION = "0.1.0";
export const STORAGE_PLAYER_DATA_KEY = `ethernaut_player_data_${VERSION}_`;
export const STORAGE_CONTRACT_DATA_KEY = `ethernaut_contract_data_`;

// Paths
export const PATH_ROOT = "/";
export const PATH_NOT_FOUND = "/404";
export const PATH_HELP = "/help";
export const PATH_LEVEL_ROOT = `${PATH_ROOT}level/`;
export const PATH_LEVEL = `${PATH_LEVEL_ROOT}:address`;
export const PATH_STATS = `${PATH_ROOT}stats`;
export const PATH_LEADERBOARD = `${PATH_ROOT}leaderboard`;

// RELEASE SENSITIVE
// -----------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------
export const CUSTOM_LOGGING = true; /* TRUE on production */
export const SHOW_ALL_COMPLETE_DESCRIPTIONS = false; /* FALSE on production */
export const SHOW_VERSION = true;

// export const ACTIVE_NETWORK = NETWORKS.BASE_SEPOLIA
// export const ACTIVE_NETWORK = NETWORKS.LOCAL;

let id_to_network = {};
Object.keys(NETWORKS)
  .filter(
    (network) => NETWORKS[network] /*&& NETWORKS[network].name !== 'local'*/
  )
  .forEach(
    (network) => (id_to_network[NETWORKS[network].id] = NETWORKS[network].name)
  );

export const ID_TO_NETWORK = id_to_network;
// -----------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------
