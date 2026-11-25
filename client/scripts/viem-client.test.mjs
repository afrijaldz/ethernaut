// Needs anvil on the PATH. Run with: pnpm --dir client test:scripts
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { after, before, describe, it } from "node:test";
import { encodeFunctionData, getAddress } from "viem";
import { ADDRESSES, NETWORKS } from "../src/constants.js";
import {
  createClients,
  deployContract,
  getDeployedContract,
  getScaledGasPrice,
  readContract,
  readStorageSlot,
  sendContractTransaction,
} from "./viem-client.mjs";

// The public test keys of anvil. The first one belongs to ADDRESSES.local.
const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const OTHER_ANVIL_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const REMOTE_NETWORK = "test-remote";

const loadArtifact = (name) =>
  JSON.parse(
    fs.readFileSync(
      new URL(`../../contracts/out/${name}.sol/${name}.json`, import.meta.url),
      "utf8"
    )
  );
const Ethernaut = loadArtifact("Ethernaut");
const Statistics = loadArtifact("Statistics");
const StatisticsLevelSuperseder = loadArtifact("StatisticsLevelSuperseder");
const ProxyAdmin = loadArtifact("ProxyAdmin");
const ProxyStats = loadArtifact("ProxyStats");

let anvil;
let port;

function startAnvil() {
  return new Promise((resolve, reject) => {
    anvil = spawn("anvil", ["--port", "0"]);
    anvil.on("error", reject);
    anvil.on("exit", (code) => reject(new Error(`anvil exited with code ${code}`)));
    let output = "";
    anvil.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/Listening on 127\.0\.0\.1:(\d+)/);
      if (match) resolve(Number(match[1]));
    });
  });
}

const localNetwork = () => ({ ...NETWORKS.LOCAL, url: "http://127.0.0.1", port });

const remoteNetwork = (privKey) => ({
  name: REMOTE_NETWORK,
  url: `http://127.0.0.1:${port}`,
  privKey,
});

before(async () => {
  port = await startAnvil();
  ADDRESSES[REMOTE_NETWORK] = ADDRESSES[NETWORKS.LOCAL.name];
});

after(() => anvil.kill());

describe("createClients", () => {
  it("rejects a key that is not the key of the operator", () => {
    assert.throws(() => createClients(remoteNetwork(OTHER_ANVIL_KEY)), /Cannot sign for/);
  });

  it("accepts a key without the 0x prefix", () => {
    const { walletClient } = createClients(remoteNetwork(ANVIL_KEY.slice(2)));
    assert.equal(walletClient.account.address, ADDRESSES[REMOTE_NETWORK]);
  });
});

const ACCOUNT_KINDS = [
  ["the account of the local node", () => localNetwork()],
  ["the private key account", () => remoteNetwork(ANVIL_KEY)],
];

for (const [name, getNetwork] of ACCOUNT_KINDS) {
  describe(`helpers with ${name}`, () => {
    let clients;
    let props;

    before(async () => {
      clients = createClients(getNetwork());
      props = { gasPrice: await getScaledGasPrice(clients, 105n), gas: 16000000n };
    });

    it("scales the gas price as a bigint", async () => {
      const gasPrice = await clients.publicClient.getGasPrice();
      assert.equal(await getScaledGasPrice(clients, 105n), (gasPrice * 105n) / 100n);
      assert.equal(await getScaledGasPrice(clients, 1000n), gasPrice * 10n);
    });

    it("deploys a contract and returns the checksum address", async () => {
      const ethernaut = await deployContract(clients, Ethernaut, [], props);
      assert.equal(ethernaut.address, getAddress(ethernaut.address));
      assert.equal(
        await readContract(clients, ethernaut, "owner"),
        clients.walletClient.account.address
      );
    });

    it("sends a legacy transaction with the given gas and gas price", async () => {
      const ethernaut = await deployContract(clients, Ethernaut, [], props);
      const statistics = await deployContract(clients, Statistics, [], props);
      const receipt = await sendContractTransaction(
        clients,
        ethernaut,
        "setStatistics",
        [statistics.address],
        props
      );
      const transaction = await clients.publicClient.getTransaction({
        hash: receipt.transactionHash,
      });
      assert.equal(transaction.type, "legacy");
      assert.equal(transaction.gas, props.gas);
      assert.equal(transaction.gasPrice, props.gasPrice);
      assert.equal(await readContract(clients, ethernaut, "statistics"), statistics.address);
    });

    it("sends transactions one after the other with the next nonce", async () => {
      const first = await deployContract(clients, Ethernaut, [], props);
      const second = await deployContract(clients, Ethernaut, [], props);
      assert.notEqual(first.address, second.address);
    });

    it("reads the maintenance flag of the superseder from storage slot 17", async () => {
      const ethernaut = await deployContract(clients, Ethernaut, [], props);
      const statistics = await deployContract(clients, Statistics, [], props);
      const proxyAdmin = await deployContract(clients, ProxyAdmin, [], props);
      const proxyStats = await deployContract(
        clients,
        ProxyStats,
        [statistics.address, proxyAdmin.address, ethernaut.address],
        props
      );
      assert.equal(await readStorageSlot(clients, proxyStats.address, 17n), 0n);

      const superseder = await deployContract(clients, StatisticsLevelSuperseder, [], props);
      const operator = clients.walletClient.account.address;
      const setOperator = encodeFunctionData({
        abi: superseder.abi,
        functionName: "setOperator",
        args: [operator],
      });
      await sendContractTransaction(
        clients,
        proxyAdmin,
        "upgradeAndCall",
        [proxyStats.address, superseder.address, setOperator],
        props
      );
      assert.equal(await readStorageSlot(clients, proxyStats.address, 17n), 1n);

      const proxyWithSupersederABI = await getDeployedContract(
        clients,
        StatisticsLevelSuperseder,
        proxyStats.address
      );
      // The superseder script compares the stage with plain numbers.
      assert.equal(await readContract(clients, proxyWithSupersederABI, "dumpStage"), 1);
    });

    it("fails when a transaction reverts", async () => {
      const ethernaut = await deployContract(clients, Ethernaut, [], props);
      // The statistics contract is not set, so the registration reverts.
      await assert.rejects(
        sendContractTransaction(clients, ethernaut, "registerLevel", [ethernaut.address], props),
        /Transaction 0x[0-9a-f]{64} reverted/
      );
    });

    it("fails when a constructor reverts", async () => {
      await assert.rejects(
        deployContract(clients, ProxyStats, [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS], props),
        /Transaction 0x[0-9a-f]{64} reverted/
      );
    });

    it("fails when an address has no contract code", async () => {
      await assert.rejects(
        getDeployedContract(clients, Ethernaut, ZERO_ADDRESS),
        /No contract code at/
      );
    });
  });
}
