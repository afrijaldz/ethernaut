import Web3 from "web3";

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

// The public RPC limits the gas and the response size of one eth_call.
const CALLS_PER_REQUEST = 100;
const REQUEST_TIMEOUT_MS = 30000;

const MULTICALL3_ABI = [
  {
    name: "aggregate3",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
];

const createView = (name, inputTypes, outputType) => ({
  name,
  type: "function",
  stateMutability: "view",
  inputs: inputTypes.map((type) => ({ name: "", type })),
  outputs: [{ name: "", type: outputType }],
});

const STATISTICS_ABI = [
  createView("getTotalNoOfPlayers", [], "uint256"),
  createView("players", ["uint256"], "address"),
  createView("getTotalNoOfLevelsCompletedByPlayer", ["address"], "uint256"),
  createView("getAverageTimeTakenToCompleteLevels", ["address"], "uint256"),
  createView(
    "getTimeElapsedForCompletionOfLevel",
    ["address", "address"],
    "uint256"
  ),
];

export const createRpcProvider = (rpcUrl) =>
  new Web3.providers.HttpProvider(rpcUrl, { timeout: REQUEST_TIMEOUT_MS });

// `levels` is a list of { address, difficulty }.
export async function fetchPlayers(provider, statisticsAddress, levels) {
  const web3 = new Web3(provider);
  const statistics = new web3.eth.Contract(STATISTICS_ABI, statisticsAddress)
    .methods;
  const multicall = new web3.eth.Contract(MULTICALL3_ABI, MULTICALL3_ADDRESS);

  const aggregate = async (methods, allowFailure) => {
    const results = [];
    for (let i = 0; i < methods.length; i += CALLS_PER_REQUEST) {
      const calls = methods.slice(i, i + CALLS_PER_REQUEST).map((method) => ({
        target: statisticsAddress,
        allowFailure,
        callData: method.encodeABI(),
      }));
      results.push(...(await multicall.methods.aggregate3(calls).call()));
    }
    return results;
  };

  const read = async (methods, type) => {
    const results = await aggregate(methods, false);
    return results.map((result) =>
      web3.eth.abi.decodeParameter(type, result.returnData)
    );
  };

  const playerCount = Number(await statistics.getTotalNoOfPlayers().call());
  const indexes = Array.from({ length: playerCount }, (_, index) => index);
  const addresses = await read(
    indexes.map((index) => statistics.players(index)),
    "address"
  );
  const completedCounts = await read(
    addresses.map((address) =>
      statistics.getTotalNoOfLevelsCompletedByPlayer(address)
    ),
    "uint256"
  );
  const averageTimes = await read(
    addresses.map((address) =>
      statistics.getAverageTimeTakenToCompleteLevels(address)
    ),
    "uint256"
  );

  const players = addresses
    .map((address, index) => ({
      player: address,
      completed: Number(completedCounts[index]),
      averageTime: Number(averageTimes[index]),
    }))
    .filter((player) => player.completed > 0);

  // This call reverts when the player has not completed the level.
  const completions = await aggregate(
    players.flatMap(({ player }) =>
      levels.map((level) =>
        statistics.getTimeElapsedForCompletionOfLevel(player, level.address)
      )
    ),
    true
  );
  // A revert of the contract has a reason. A call that ran out of gas has no data.
  if (completions.some((call) => !call.success && call.returnData === "0x")) {
    throw new Error("A completion call failed without a revert reason");
  }

  return players.map((player, playerIndex) => {
    const firstCall = playerIndex * levels.length;
    const completedLevels = levels.filter(
      (_, levelIndex) => completions[firstCall + levelIndex].success
    );
    return { ...player, difficultyFaced: sumDifficulty(completedLevels) };
  });
}

const sumDifficulty = (levels) =>
  levels.reduce((sum, level) => sum + level.difficulty, 0);

export function calculateScore(player, levels) {
  const { completed, difficultyFaced, averageTime } = player;
  return (
    100 *
    ((0.8 * completed) / levels.length +
      (0.1 * difficultyFaced) / sumDifficulty(levels) +
      (0.1 * 15) / Math.max(averageTime, 15))
  );
}

export function rankPlayers(players, levels) {
  return players
    .filter((player) => player.completed > 0)
    .map((player) => ({ ...player, score: calculateScore(player, levels) }))
    .sort((a, b) => b.score - a.score)
    .map((player, index) => ({ ...player, rank: index + 1 }));
}
