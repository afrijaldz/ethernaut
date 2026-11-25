import * as ethjs from 'ethereumjs-util';
import TruffleContract from '@truffle/contract';
import * as constants from "../constants.js";
import { NETWORKS_INGAME } from '../constants.js'

let web3;
let connectedContract;

export const setWeb3 = (_web3) => {
  web3 = _web3;
  // Truffle adds listeners to the wallet provider on every setProvider call and never
  // removes them. So only this contract calls it, and all others share its connection.
  connectedContract = TruffleContract({ abi: [] });
  connectedContract.setProvider(web3.currentProvider);
}

export const getWeb3 = () => web3;

export const getTruffleContract = (jsonABI, defaults = {}) => {
  // // HACK: Doing this here instead of `import` so that the project uses the web3.js version
  // // defined in `package.json` instead of relying on Truffle dependencies (that use an old version).
  // const TruffleContract = require('@truffle/contract');

  const truffleContract = TruffleContract({ abi: jsonABI.abi, bytecode: jsonABI.bytecode.object });
  if (!defaults.gasPrice) defaults.gasPrice = 2000000000;
  if (!defaults.gas) defaults.gas = 2000000;
  truffleContract.defaults(defaults);
  truffleContract.web3 = connectedContract.web3;
  truffleContract.interfaceAdapter = connectedContract.interfaceAdapter;
  truffleContract.currentProvider = connectedContract.currentProvider;
  truffleContract.networkType = connectedContract.networkType;
  return truffleContract;
}

export const getBalance = (address) => {
  return new Promise(function (resolve, reject) {
    web3.eth.getBalance(address, function (error, result) {
      if (error) reject(error)
      else resolve(web3.utils.fromWei(result, 'ether'))
    })
  })
}

export const getBlockNumber = () => {
  return new Promise((resolve, reject) => {
    web3.eth.getBlockNumber((err, blockNumber) => {
      if (err) reject(err)
      resolve(blockNumber);
    });
  });
}

export const sendTransaction = (options) => {
  return new Promise((resolve, reject) => {
    web3.eth.sendTransaction(options, (err, res) => {
      if (err) reject(err)
      else resolve(res)
    })
  })
}

export const getNetworkId = () => {
  return new Promise((resolve, reject) => {
    web3.eth.net.getId((err, netId) => {
      if (err) reject();
      else resolve(netId);
    });
  });
}

export const toWei = (ether) => {
  return web3.utils.toWei(ether, 'ether')
}

export const fromWei = (wei) => {
  return web3.utils.fromWei(wei, 'ether')
}

export const watchAccountChanges = (callback, lastKnownAccount) => {
  let interval = setInterval(function () {
    web3.eth.getAccounts(function (error, accounts) {
      if (error) return console.log(error)
      const newAccount = accounts[0]
      if (newAccount !== lastKnownAccount) {
        callback(newAccount)
        clearInterval(interval)
        this.watchAccountChanges(callback, newAccount);
      }
    })
  }, 1000)
}

export const watchNetwork = (callbacks) => {

  // Gas price
  if (callbacks.gasPrice) {
    const gasPrice = function () {
      web3.eth.getGasPrice(function (error, result) {
        if (error) return console.log(error)
        callbacks.gasPrice(result)
      })
    }
    gasPrice()
    setInterval(gasPrice, 30 * 60000)
  }

  // Network id
  if (callbacks.networkId) {
    const netId = function () {
      web3.eth.net.getId(function (error, result) {
        if (error) return console.log(error)
        callbacks.networkId(result)
      })
    }
    netId()
    setInterval(netId, 5 * 1000)
  }

  // Block num
  if (callbacks.blockNum) {
    const blockNum = function () {
      web3.eth.getBlockNumber((err, blockNumber) => {
        if (err) console.log(err)
        callbacks.blockNum(blockNumber);
      });
    }
    blockNum()
    setInterval(blockNum, 10 * 1000)
  }

}

export const validateAddress = (address) => {
  if (!address) return false;
  if (address === '0x0000000000000000000000000000000000000000') return false;
  if (address.substring(0, 2) !== "0x") return false;

  // Basic validation: length, valid characters, etc
  if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) return false;

  // Checksum validation.
  const raw = address.replace('0x', '');
  const allLowerCase = raw.toLowerCase() === raw;
  const allUppercase = raw.toUpperCase() === raw;
  if (allLowerCase || allUppercase) {
    return true; // accepts address with no checksum data
  }
  else {
    const checksum = ethjs.toChecksumAddress(address);
    if (address !== checksum) return false;
  }

  return true;
}

export const addressHasChecksum = (address) => {
  if (!module.exports.isValidAddress(address)) return false;
  const raw = address.replace('0x', '');
  const allLowerCase = raw.toLowerCase() === raw;
  const allUppercase = raw.toUpperCase() === raw;
  return !(allLowerCase || allUppercase);
}

export const verifySignature = (json) => {
  try {
    const messageHash = ethjs.hashPersonalMessage(ethjs.toBuffer(json.msg));
    const signedMessageDecoded = ethjs.fromRpcSig(json.sig);
    const recoveredPublicKey = ethjs.ecrecover(messageHash, signedMessageDecoded.v, signedMessageDecoded.r, signedMessageDecoded.s);
    const recoveredAddressBuffer = ethjs.pubToAddress(recoveredPublicKey);
    const recoveredAddress = ethjs.bufferToHex(recoveredAddressBuffer);
    return json.address === recoveredAddress;
  }
  catch (err) {
    return false;
  }
}

export const getGasFeeDetails = async (network, multiplier) => {
  if (constants.SUPPORTS_EIP_1559.includes(network.networkId.toString())) {
    const maxPriorityFeePerGas = network.web3.utils.toWei('2.5', 'gwei');
    const block = await network.web3.eth.getBlock('latest')
    const blockBaseFee = block.baseFeePerGas ? block.baseFeePerGas : 1;
    return {
      maxPriorityFeePerGas,
      maxFeePerGas: multiplier * Number(blockBaseFee) + Number(maxPriorityFeePerGas)
    }
  } else {
    const gasPrice = await network.web3.eth.getGasPrice()
    return {
      gasPrice: multiplier * gasPrice
    }
  }
}

export const getNetworkFromId = (networkId) => {
  const networkObjectsList = Object.values(NETWORKS_INGAME);
  for (let network of networkObjectsList)
    if (network && network.id === networkId.toString())
      return network;
}
