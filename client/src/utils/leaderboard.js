import { createPublicClient, decodeAbiParameters, encodeFunctionData, http } from "viem";

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

export const createRpcClient = (rpcUrl) =>
  createPublicClient({ transport: http(rpcUrl, { timeout: REQUEST_TIMEOUT_MS }) });

// `levels` is a list of { address, difficulty }.
export async function fetchPlayers(publicClient, statisticsAddress, levels) {
  const aggregate = async (functionName, argsList, allowFailure) => {
    const results = [];
    for (let i = 0; i < argsList.length; i += CALLS_PER_REQUEST) {
      const calls = argsList.slice(i, i + CALLS_PER_REQUEST).map((args) => ({
        target: statisticsAddress,
        allowFailure,
        callData: encodeFunctionData({ abi: STATISTICS_ABI, functionName, args }),
      }));
      const chunk = await publicClient.readContract({
        address: MULTICALL3_ADDRESS,
        abi: MULTICALL3_ABI,
        functionName: "aggregate3",
        args: [calls],
      });
      results.push(...chunk);
    }
    return results;
  };

  const read = async (functionName, argsList, type) => {
    const results = await aggregate(functionName, argsList, false);
    return results.map(
      (result) => decodeAbiParameters([{ type }], result.returnData)[0]
    );
  };

  const playerCount = Number(
    await publicClient.readContract({
      address: statisticsAddress,
      abi: STATISTICS_ABI,
      functionName: "getTotalNoOfPlayers",
    })
  );
  const indexes = Array.from({ length: playerCount }, (_, index) => [BigInt(index)]);
  const addresses = await read("players", indexes, "address");
  const playerArgs = addresses.map((address) => [address]);
  const completedCounts = await read(
    "getTotalNoOfLevelsCompletedByPlayer",
    playerArgs,
    "uint256"
  );
  const averageTimes = await read(
    "getAverageTimeTakenToCompleteLevels",
    playerArgs,
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
    "getTimeElapsedForCompletionOfLevel",
    players.flatMap(({ player }) => levels.map((level) => [player, level.address])),
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
