const deployFiles = import.meta.glob("../gamedata/deploy.*.json", {
  eager: true,
  import: "default",
});

export const getDeployFile = (networkName) =>
  deployFiles[`../gamedata/deploy.${networkName}.json`];
