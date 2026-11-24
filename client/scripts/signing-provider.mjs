import Web3 from "web3";

// Provider for the operator scripts on remote networks.
// eth_sendTransaction is signed here with the operator key and sent as
// eth_sendRawTransaction, because the RPC node holds no accounts.
// Every other request goes to the RPC node unchanged.
export function createSigningProvider(rpcUrl, privateKey) {
  const httpProvider = new Web3.providers.HttpProvider(rpcUrl);
  const web3 = new Web3(httpProvider);
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);

  function send(payload, callback) {
    if (payload.method === "eth_accounts") {
      callback(null, {
        jsonrpc: "2.0",
        id: payload.id,
        result: [account.address],
      });
      return;
    }

    if (payload.method !== "eth_sendTransaction") {
      httpProvider.send(payload, callback);
      return;
    }

    const tx = payload.params[0];
    if (tx.from.toLowerCase() !== account.address.toLowerCase()) {
      callback(
        new Error(`Cannot sign for ${tx.from}, the key is for ${account.address}`)
      );
      return;
    }

    account
      .signTransaction(tx)
      .then((signed) => {
        httpProvider.send(
          {
            jsonrpc: "2.0",
            id: payload.id,
            method: "eth_sendRawTransaction",
            params: [signed.rawTransaction],
          },
          callback
        );
      })
      .catch((error) => callback(error));
  }

  return { send, sendAsync: send };
}
