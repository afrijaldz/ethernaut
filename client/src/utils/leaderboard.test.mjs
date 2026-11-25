// Run with: node --test client/src/utils/leaderboard.test.mjs
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  createPublicClient,
  custom,
  decodeAbiParameters,
  encodeAbiParameters,
  getAddress,
  pad,
  toFunctionSelector,
  toHex,
} from "viem";
import { calculateScore, fetchPlayers, rankPlayers } from "./leaderboard.js";

const encode = (type, value) => encodeAbiParameters([{ type }], [value]);
const STATISTICS = "0xB4D82aA77d499bC27667637Fa8CE2fa9E4365F3b";
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const CALLS_TYPE = {
  type: "tuple[]",
  components: [{ type: "address" }, { type: "bool" }, { type: "bytes" }],
};
const RESULTS_TYPE = {
  type: "tuple[]",
  components: [{ type: "bool" }, { type: "bytes" }],
};
const REVERT_DATA =
  "0x08c379a0" +
  encode("string", "Level not completed").slice(2);

const createAddress = (number) =>
  getAddress(pad(toHex(number), { size: 20 }));

const LEVELS = [
  { address: createAddress(1001), difficulty: 0 },
  { address: createAddress(1002), difficulty: 1 },
  { address: createAddress(1003), difficulty: 4 },
];

const decodeCall = (types, data) =>
  decodeAbiParameters(types, "0x" + data.slice(10));

const isCallTo = (data, signature) =>
  data.startsWith(toFunctionSelector(signature));

// A chain with the Statistics contract and Multicall3. A player is { address, averageTime, levels }.
// `fail` receives the calldata of each eth_call and can throw.
function createProvider(players, { fail = () => {}, emptyRevert = false } = {}) {
  const callStatistics = (data) => {
    if (isCallTo(data, "getTotalNoOfPlayers()")) {
      return encode("uint256", players.length);
    }
    if (isCallTo(data, "players(uint256)")) {
      const [index] = decodeCall([{ type: "uint256" }], data);
      return encode("address", players[index].address);
    }
    const [address] = decodeCall([{ type: "address" }], data);
    const player = players.find((item) => item.address === address);
    if (isCallTo(data, "getTotalNoOfLevelsCompletedByPlayer(address)")) {
      return encode("uint256", player.levels.length);
    }
    if (isCallTo(data, "getAverageTimeTakenToCompleteLevels(address)")) {
      return encode("uint256", player.averageTime);
    }
    assert.ok(
      isCallTo(data, "getTimeElapsedForCompletionOfLevel(address,address)")
    );
    const [, level] = decodeCall([{ type: "address" }, { type: "address" }], data);
    if (!player.levels.includes(level)) return null;
    // The time is zero when the instance is created and solved in one block.
    return encode("uint256", 0);
  };

  return {
    request: mock.fn(async ({ method, params }) => {
      assert.equal(method, "eth_call");
      const { to, data } = params[0];
      fail(data);
      if (to.toLowerCase() === STATISTICS.toLowerCase()) {
        return callStatistics(data);
      }
      assert.equal(to.toLowerCase(), MULTICALL3.toLowerCase());
      const [calls] = decodeCall([CALLS_TYPE], data);
      const results = calls.map(([target, allowFailure, callData]) => {
        assert.equal(target, STATISTICS);
        assert.equal(
          allowFailure,
          isCallTo(
            callData,
            "getTimeElapsedForCompletionOfLevel(address,address)"
          )
        );
        const result = callStatistics(callData);
        if (result) return [true, result];
        return [false, emptyRevert ? "0x" : REVERT_DATA];
      });
      return encodeAbiParameters([RESULTS_TYPE], [results]);
    }),
  };
}

const createClient = (provider) =>
  createPublicClient({ transport: custom(provider, { retryCount: 0 }) });

const createPlayer = (number, levels, averageTime = 60) => ({
  address: createAddress(number),
  averageTime,
  levels: levels.map((level) => level.address),
});

describe("players", () => {
  it("counts a successful call as completed and a revert as not completed", async () => {
    const provider = createProvider([
      createPlayer(1, [LEVELS[0], LEVELS[2]], 30),
      createPlayer(2, LEVELS, 90),
    ]);
    assert.deepEqual(await fetchPlayers(createClient(provider), STATISTICS, LEVELS), [
      { player: createAddress(1), completed: 2, averageTime: 30, difficultyFaced: 4 },
      { player: createAddress(2), completed: 3, averageTime: 90, difficultyFaced: 5 },
    ]);
  });

  it("does not return players without a completed level", async () => {
    const provider = createProvider([
      createPlayer(1, []),
      createPlayer(2, [LEVELS[1]]),
    ]);
    const players = await fetchPlayers(createClient(provider), STATISTICS, LEVELS);
    assert.deepEqual(
      players.map((item) => item.player),
      [createAddress(2)]
    );
  });

  it("is empty without players", async () => {
    assert.deepEqual(
      await fetchPlayers(createClient(createProvider([])), STATISTICS, LEVELS),
      []
    );
  });

  it("splits the calls into chunks and keeps their order", async () => {
    const all = Array.from({ length: 120 }, (_, index) =>
      createPlayer(index + 1, [LEVELS[index % 3]])
    );
    const provider = createProvider(all);
    const players = await fetchPlayers(createClient(provider), STATISTICS, LEVELS);
    assert.deepEqual(
      players.map((item) => [item.player, item.difficultyFaced]),
      all.map((item, index) => [item.address, LEVELS[index % 3].difficulty])
    );
    // 1 for the count, 3 times 2 for the players, and 4 for the 360 levels.
    assert.equal(provider.request.mock.callCount(), 11);
  });
});

describe("failures", () => {
  const players = [createPlayer(1, [LEVELS[0]])];

  for (const signature of [
    "getTotalNoOfPlayers()",
    "players(uint256)",
    "getTotalNoOfLevelsCompletedByPlayer(address)",
    "getAverageTimeTakenToCompleteLevels(address)",
    "getTimeElapsedForCompletionOfLevel(address,address)",
  ]) {
    it(`fails when the request for ${signature} fails`, async () => {
      const selector = toFunctionSelector(signature).slice(2);
      const provider = createProvider(players, {
        fail: (data) => {
          if (data.includes(selector)) throw new Error("rate limited");
        },
      });
      await assert.rejects(
        fetchPlayers(createClient(provider), STATISTICS, LEVELS),
        /rate limited/
      );
    });
  }

  it("fails when a later chunk fails", async () => {
    const all = Array.from({ length: 120 }, (_, index) =>
      createPlayer(index + 1, [LEVELS[0]])
    );
    let requests = 0;
    const provider = createProvider(all, {
      fail: () => {
        requests += 1;
        if (requests === 11) throw new Error("rate limited");
      },
    });
    await assert.rejects(
      fetchPlayers(createClient(provider), STATISTICS, LEVELS),
      /rate limited/
    );
  });

  it("fails when a completion call fails without a revert reason", async () => {
    const provider = createProvider(players, { emptyRevert: true });
    await assert.rejects(
      fetchPlayers(createClient(provider), STATISTICS, LEVELS),
      /without a revert reason/
    );
  });
});

describe("score", () => {
  const assertScore = (player, expected) =>
    assert.ok(Math.abs(calculateScore(player, LEVELS) - expected) < 1e-9);

  it("is 100 for all levels in 15 seconds", () => {
    assertScore({ completed: 3, difficultyFaced: 5, averageTime: 15 }, 100);
  });

  it("does not increase below 15 seconds", () => {
    assertScore({ completed: 3, difficultyFaced: 5, averageTime: 0 }, 100);
  });

  it("uses the completed levels, the difficulty, and the time", () => {
    // 80 * 2/3 + 10 * 4/5 + 10 * 15/60
    assertScore(
      { completed: 2, difficultyFaced: 4, averageTime: 60 },
      160 / 3 + 8 + 2.5
    );
  });
});

describe("ranks", () => {
  it("follow the score, highest first", () => {
    const players = [
      { player: "slow", completed: 1, difficultyFaced: 1, averageTime: 900 },
      { player: "none", completed: 0, difficultyFaced: 0, averageTime: 0 },
      { player: "best", completed: 3, difficultyFaced: 5, averageTime: 60 },
      { player: "fast", completed: 1, difficultyFaced: 1, averageTime: 15 },
    ];
    assert.deepEqual(
      rankPlayers(players, LEVELS).map(({ player, rank }) => [player, rank]),
      [
        ["best", 1],
        ["fast", 2],
        ["slow", 3],
      ]
    );
  });
});
