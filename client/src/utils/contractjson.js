const contractJsonLoaders = import.meta.glob("../contracts/out/*/*.json", {
  import: "default",
});

// Loads the compiled contract `contractName` of the Solidity file `fileName`.
export function loadContractJson(fileName, contractName) {
  return contractJsonLoaders[
    `../contracts/out/${fileName}/${contractName}.json`
  ]();
}
