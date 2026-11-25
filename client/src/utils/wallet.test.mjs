// Run with: node --test client/src/utils/wallet.test.mjs
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import * as ethutil from "./ethutil.js";

const storage = new Map();
globalThis.window = new EventTarget();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

const NETWORK = {
  id: "84532",
  name: "base-sepolia",
  currencyName: "Base-ETH",
  currencySymbol: "ETH",
  rpcUrl: "https://sepolia.base.org",
  blockExplorer: "https://sepolia.basescan.org",
};

let wallet;

// Answers each method from `answers`. A function is called, an Error-like value is thrown.
function createProvider(answers) {
  return {
    request: mock.fn(async ({ method }) => {
      const answer = answers[method];
      if (answer && answer.code) throw answer;
      return typeof answer === "function" ? answer() : answer;
    }),
  };
}

function createWallet(name, provider = createProvider({})) {
  return { info: { uuid: name, name, rdns: `com.${name}`, icon: "" }, provider };
}

function announce(detail) {
  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", { detail })
  );
}

const getMethods = (provider) =>
  provider.request.mock.calls.map((call) => call.arguments[0].method);

let testNumber = 0;

beforeEach(async () => {
  mock.method(console, "error", () => {});
  storage.clear();
  globalThis.window = new EventTarget();
  // The module holds state, so each test loads its own copy.
  wallet = await import(`./wallet.js?test=${testNumber++}`);
  wallet.discoverWallets();
});

afterEach(() => {
  mock.restoreAll();
});

describe("discovery", () => {
  it("requests announcements", () => {
    const listener = mock.fn();
    window.addEventListener("eip6963:requestProvider", listener);
    wallet.discoverWallets();
    window.removeEventListener("eip6963:requestProvider", listener);
    assert.equal(listener.mock.callCount(), 1);
  });

  it("tells the subscribers about a late announcement", () => {
    const listener = mock.fn();
    const unsubscribe = wallet.subscribeToWallets(listener);
    announce(createWallet("first"));
    assert.equal(listener.mock.callCount(), 1);
    assert.equal(wallet.getWallets().length, 1);
    unsubscribe();
    announce(createWallet("second"));
    assert.equal(listener.mock.callCount(), 1);
    assert.equal(wallet.getWallets().length, 2);
  });

  it("lists a wallet that announces itself twice only once", () => {
    announce(createWallet("first"));
    announce(createWallet("first"));
    assert.equal(wallet.getWallets().length, 1);
  });

  it("ignores malformed announcements", () => {
    announce(null);
    announce({ info: { uuid: "x", name: "x" } });
    announce({ info: { uuid: "x", name: "x", rdns: "x" }, provider: {} });
    assert.equal(wallet.getWallets().length, 0);
  });

  it("offers window.ethereum only when no wallet announced itself", () => {
    window.ethereum = createProvider({});
    assert.equal(wallet.getWallets()[0].provider, window.ethereum);
    const first = createWallet("first");
    announce(first);
    assert.deepEqual(wallet.getWallets(), [first]);
  });

  it("accepts only data image icons", () => {
    const icon = "data:image/svg+xml,x";
    assert.equal(wallet.getSafeIcon({ icon }), icon);
    assert.equal(wallet.getSafeIcon({ icon: "https://example.com/x.png" }), null);
    assert.equal(wallet.getSafeIcon({ icon: "javascript:alert(1)" }), null);
    assert.equal(wallet.getSafeIcon({}), null);
  });
});

describe("remembered wallet", () => {
  beforeEach(() => {
    localStorage.setItem(wallet.STORAGE_WALLET_KEY, "com.second");
  });

  it("is restored after a late announcement, without a prompt", async () => {
    const second = createWallet(
      "second",
      createProvider({ eth_accounts: ["0x1"] })
    );
    const restored = wallet.restoreWallet();
    announce(createWallet("first"));
    announce(second);
    assert.equal(await restored, true);
    assert.equal(wallet.getProvider(), second.provider);
    assert.deepEqual(getMethods(second.provider), ["eth_accounts"]);
  });

  it("is not restored without a connected account", async () => {
    announce(createWallet("second", createProvider({ eth_accounts: [] })));
    assert.equal(await wallet.restoreWallet(), false);
    assert.equal(wallet.getProvider(), undefined);
  });

  it("is not restored when the wallet is gone", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    const restored = wallet.restoreWallet();
    announce(createWallet("first"));
    mock.timers.runAll();
    mock.timers.reset();
    assert.equal(await restored, false);
  });

  it("is not restored when the wallet returns an error", async () => {
    announce(
      createWallet("second", createProvider({ eth_accounts: { code: -32603 } }))
    );
    assert.equal(await wallet.restoreWallet(), false);
  });

  it("can be the wallet in window.ethereum", async () => {
    window.ethereum = createProvider({ eth_accounts: ["0x1"] });
    wallet.selectWallet(wallet.getWallets()[0]);
    assert.equal(await wallet.restoreWallet(), true);
    assert.equal(wallet.getProvider(), window.ethereum);
  });
});

describe("connection", () => {
  it("uses only the second wallet after it is chosen", async () => {
    const answers = {
      eth_requestAccounts: ["0x1"],
      eth_chainId: "0x14a34",
      wallet_switchEthereumChain: null,
    };
    const first = createWallet("first", createProvider(answers));
    const second = createWallet("second", createProvider(answers));
    window.ethereum = first.provider;
    announce(first);
    announce(second);

    const chosen = wallet.getWallets()[1];
    assert.equal(await wallet.requestAccounts(chosen), wallet.RESULT.DONE);
    wallet.selectWallet(chosen);
    assert.equal(await wallet.switchNetwork(NETWORK), wallet.RESULT.DONE);

    assert.equal(wallet.getProvider(), second.provider);
    assert.equal(first.provider.request.mock.callCount(), 0);
    assert.deepEqual(getMethods(second.provider), [
      "eth_requestAccounts",
      "wallet_switchEthereumChain",
      "eth_chainId",
    ]);
    assert.equal(localStorage.getItem(wallet.STORAGE_WALLET_KEY), "com.second");
  });

  it("sends the transactions to the selected wallet", async () => {
    const first = createWallet("first");
    const second = createWallet(
      "second",
      createProvider({ eth_sendTransaction: { code: 4001, message: "No" } })
    );
    window.ethereum = first.provider;
    wallet.selectWallet(second);
    const address = "0x0000000000000000000000000000000000000001";
    ethutil.connectProvider(wallet.getProvider(), 84532, address);
    await assert.rejects(
      ethutil.sendTransaction({ to: address, gas: 1, gasPrice: 1 }),
      { code: 4001 }
    );
    assert.ok(getMethods(second.provider).includes("eth_sendTransaction"));
    assert.equal(first.provider.request.mock.callCount(), 0);
  });

  it("returns the connected account with checksum", async () => {
    const account = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    wallet.selectWallet(
      createWallet("first", createProvider({ eth_accounts: [account.toLowerCase()] }))
    );
    assert.equal(await wallet.getAccount(), account);
  });

  it("reports a rejection and other errors", async () => {
    const request = (code) =>
      wallet.requestAccounts(
        createWallet("first", createProvider({ eth_requestAccounts: { code } }))
      );
    assert.equal(await request(4001), wallet.RESULT.REJECTED);
    assert.equal(await request(5000), wallet.RESULT.REJECTED);
    assert.equal(await request(-32002), wallet.RESULT.FAILED);
  });
});

describe("network switch", () => {
  const switchWith = async (answers) => {
    const provider = createProvider(answers);
    wallet.selectWallet(createWallet("first", provider));
    const result = await wallet.switchNetwork(NETWORK);
    return { result, methods: getMethods(provider) };
  };

  it("does not add the chain after a rejection", async () => {
    const { result, methods } = await switchWith({
      wallet_switchEthereumChain: { code: 4001 },
    });
    assert.equal(result, wallet.RESULT.REJECTED);
    assert.deepEqual(methods, ["wallet_switchEthereumChain"]);
  });

  for (const code of [4902, -32603]) {
    it(`adds the chain after error ${code}`, async () => {
      const { result, methods } = await switchWith({
        wallet_switchEthereumChain: { code },
        wallet_addEthereumChain: null,
        eth_chainId: "0x14a34",
      });
      assert.equal(result, wallet.RESULT.DONE);
      assert.deepEqual(methods, [
        "wallet_switchEthereumChain",
        "wallet_addEthereumChain",
        "eth_chainId",
      ]);
    });
  }

  it("reports a rejection to add the chain", async () => {
    const { result } = await switchWith({
      wallet_switchEthereumChain: { code: 4902 },
      wallet_addEthereumChain: { code: 4001 },
    });
    assert.equal(result, wallet.RESULT.REJECTED);
  });

  it("fails when the wallet cannot add the chain", async () => {
    const { result } = await switchWith({
      wallet_switchEthereumChain: { code: 4902 },
      wallet_addEthereumChain: { code: -32601 },
    });
    assert.equal(result, wallet.RESULT.FAILED);
  });

  it("fails when the wallet stays on another chain", async () => {
    const { result } = await switchWith({
      wallet_switchEthereumChain: null,
      eth_chainId: "0x1",
    });
    assert.equal(result, wallet.RESULT.FAILED);
  });
});

describe("WalletConnect", () => {
  const ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const ACCEPTED = { namespaces: { eip155: { accounts: [`eip155:84532:${ACCOUNT}`] } } };
  const REFUSED = { namespaces: { eip155: { accounts: [`eip155:1:${ACCOUNT}`] } } };

  let provider;
  let init;
  let loadPackage;

  // `connect` is what the wallet answers to the connection: a session or an error message.
  function enable({ session, connect, disconnect = async () => {} } = {}) {
    const listeners = new Map();
    provider = {
      ...createProvider({ eth_accounts: [ACCOUNT], eth_chainId: 84532 }),
      session,
      signer: { client: {} },
      modal: { setThemeMode: mock.fn() },
      on: (event, listener) => listeners.set(event, listener),
      emit: (event) => listeners.get(event)(),
      connect: mock.fn(async () => {
        if (typeof connect === "string") throw new Error(connect);
        provider.session = await connect;
      }),
      disconnect: mock.fn(async () => {
        await disconnect();
        provider.session = undefined;
      }),
    };
    init = mock.fn(async () => provider);
    loadPackage = mock.fn(async () => ({ EthereumProvider: { init } }));
    wallet.enableWalletConnect("project", loadPackage);
  }

  beforeEach(() => {
    window.location = { origin: "https://example.com", reload: mock.fn() };
    globalThis.document = { documentElement: { dataset: { theme: "dark" } } };
  });

  const getEntry = () => wallet.getWallets().at(-1);

  it("is not offered without a project ID", () => {
    wallet.enableWalletConnect(undefined, loadPackage);
    wallet.enableWalletConnect("", loadPackage);
    assert.deepEqual(wallet.getWallets(), []);
  });

  it("is listed after the browser wallets and loads nothing", async () => {
    enable();
    const first = createWallet("first");
    announce(first);
    assert.deepEqual(wallet.getWallets(), [first, getEntry()]);
    assert.equal(getEntry().info.name, "WalletConnect");
    assert.equal(await wallet.restoreWallet(), false);
    assert.equal(loadPackage.mock.callCount(), 0);
  });

  it("connects on Base Sepolia and sends the requests to its provider", async () => {
    enable({ connect: ACCEPTED });
    assert.equal(await wallet.requestAccounts(getEntry()), wallet.RESULT.DONE);
    wallet.selectWallet(getEntry());

    const [options] = init.mock.calls[0].arguments;
    assert.deepEqual(options.optionalChains, [84532]);
    assert.deepEqual(options.rpcMap, { 84532: "https://sepolia.base.org" });
    assert.equal(options.showQrModal, true);
    assert.deepEqual(provider.modal.setThemeMode.mock.calls[0].arguments, ["dark"]);
    assert.deepEqual(getMethods(provider), ["wallet_switchEthereumChain"]);
    assert.equal(wallet.getProvider(), provider);
    assert.equal(await wallet.getAccount(), ACCOUNT);
    assert.equal(wallet.isWalletConnectSelected(), true);
    assert.equal(localStorage.getItem(wallet.STORAGE_WALLET_KEY), "walletconnect");
  });

  it("opens one connection for two clicks", async () => {
    enable({ connect: ACCEPTED });
    const results = await Promise.all([
      wallet.requestAccounts(getEntry()),
      wallet.requestAccounts(getEntry()),
    ]);
    assert.deepEqual(results, [wallet.RESULT.DONE, wallet.RESULT.DONE]);
    assert.equal(provider.connect.mock.callCount(), 1);
  });

  it("ends the session of a wallet that does not accept Base Sepolia", async () => {
    enable({ connect: REFUSED });
    assert.equal(await wallet.requestAccounts(getEntry()), wallet.RESULT.WRONG_NETWORK);
    assert.equal(provider.disconnect.mock.callCount(), 1);
  });

  for (const [message, result] of [
    ["Connection request reset. Please try again.", "REJECTED"],
    ["User rejected.", "REJECTED"],
    ["User disapproved requested methods", "REJECTED"],
    ["User disapproved requested chains", "WRONG_NETWORK"],
    ["Unsupported chains.", "WRONG_NETWORK"],
    ["Proposal expired", "FAILED"],
  ]) {
    it(`reports "${message}" as ${result} and can try again`, async () => {
      enable({ connect: message });
      for (let i = 0; i < 2; i++) {
        assert.equal(await wallet.requestAccounts(getEntry()), wallet.RESULT[result]);
      }
      assert.equal(provider.connect.mock.callCount(), 2);
      assert.equal(init.mock.callCount(), 1);
      assert.equal(wallet.getProvider(), undefined);
      assert.equal(window.location.reload.mock.callCount(), 0);
    });
  }

  it("fails when the package does not load", async () => {
    wallet.enableWalletConnect("project", async () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    assert.equal(await wallet.requestAccounts(getEntry()), wallet.RESULT.FAILED);
  });

  describe("saved session", () => {
    beforeEach(() => {
      localStorage.setItem(wallet.STORAGE_WALLET_KEY, "walletconnect");
    });

    it("is restored without a prompt", async () => {
      enable({ session: ACCEPTED });
      assert.equal(await wallet.restoreWallet(), true);
      assert.equal(wallet.getProvider(), provider);
      assert.equal(init.mock.calls[0].arguments[0].showQrModal, false);
      assert.equal(provider.connect.mock.callCount(), 0);
    });

    it("is not restored without a project ID", async () => {
      mock.timers.enable({ apis: ["setTimeout"] });
      const restored = wallet.restoreWallet();
      mock.timers.runAll();
      mock.timers.reset();
      assert.equal(await restored, false);
    });

    for (const [name, session] of [["ended", undefined], ["without Base Sepolia", REFUSED]]) {
      it(`that is ${name} is not restored`, async () => {
        enable({ session, connect: ACCEPTED });
        assert.equal(await wallet.restoreWallet(), false);
        assert.equal(wallet.getProvider(), undefined);

        // The next connection reuses the client and replaces the session.
        assert.equal(await wallet.requestAccounts(getEntry()), wallet.RESULT.DONE);
        assert.equal(init.mock.calls[1].arguments[0].client, provider.signer.client);
        assert.equal(provider.disconnect.mock.callCount(), session ? 1 : 0);
      });
    }

    it("that the wallet ends returns to the connection dialog", async () => {
      enable({ session: ACCEPTED });
      await wallet.restoreWallet();
      provider.emit("disconnect");
      assert.equal(localStorage.getItem(wallet.STORAGE_WALLET_KEY), null);
      assert.equal(window.location.reload.mock.callCount(), 1);
    });

    it("that the wallet ends does not touch another selected wallet", async () => {
      enable({ session: ACCEPTED });
      await wallet.restoreWallet();
      wallet.selectWallet(createWallet("first"));
      provider.emit("disconnect");
      assert.equal(localStorage.getItem(wallet.STORAGE_WALLET_KEY), "com.first");
      assert.equal(window.location.reload.mock.callCount(), 0);
    });

    for (const [name, disconnect] of [
      ["", undefined],
      [" also when the wallet cannot be told", () => Promise.reject(new Error("offline"))],
    ]) {
      it(`is closed by a disconnect${name}`, async () => {
        enable({ session: ACCEPTED, disconnect });
        await wallet.restoreWallet();
        await wallet.disconnectWalletConnect();
        assert.equal(provider.disconnect.mock.callCount(), 1);
        assert.equal(localStorage.getItem(wallet.STORAGE_WALLET_KEY), null);
        assert.equal(window.location.reload.mock.callCount(), 1);
      });
    }
  });
});
