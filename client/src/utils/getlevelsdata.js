import { onPredeployedNetwork } from "../middlewares/setNetwork";
import { getLevelKey, restoreContract } from "./contractutil";

import gamedata from "../gamedata/gamedata.json";
import { getDeployFile } from "./deployfile";
import { ID_TO_NETWORK } from "../constants";

const levels = gamedata.levels;

// Only the file names are used, the images are served from the public folder.
const imagePaths = Object.keys(import.meta.glob("../../public/imgs/Level*.{svg,png}"));


export const getLevelDetailsByAddress = (levelAddress, chainId) => {
    // If we are on a predeployed chain, fetch address from constants
    const deployData = onPredeployedNetwork(chainId)
    ? getDeployFile(ID_TO_NETWORK[chainId])
    : restoreContract("77");
    // If we are not fetch from localstorage
    // based on the index fetch the level name and difficulty
    const addressToId = Object.fromEntries(
      Object.entries(deployData).map((a) => a.reverse())
    );
    const levelId = addressToId[levelAddress];
    const currentLevel = levels[levelId];
    // include the difficulty circles to give more context
    const difficultyCircles = drawDifficultyCircle(currentLevel?.difficulty)
    return {...currentLevel, difficultyCircles};
};

export const drawDifficultyCircle = (levelDifficulty) => {
    //Put as many ● as difficulty/2 (scaled from 10 to 5) and ○ as the rest up to 5
    var numberOfFullCircles = Math.ceil(levelDifficulty / 2);
    var numberOfEmptyCircles = 5 - numberOfFullCircles;
    var emptyCircle = "○";
    var fullCircle = "●";
    var difficulty = "";
    for (var j = 0; j < numberOfFullCircles; j++) {
      difficulty += fullCircle;
    }
  
    for (var k = 0; k < numberOfEmptyCircles; k++) {
      difficulty += emptyCircle;
    }

    return difficulty;
};

const getlevelsdata = (props, source) => {
    var levelData = [];
    let linkStyle = {};
    let levelComplete;
    let selectedIndex;

    for (var i = 0; i < levels.length; i++) {
        var difficulty = drawDifficultyCircle(levels[i].difficulty);

        if (props?.activeLevel) {
            const key = getLevelKey(props.params?.address);
            if (props.activeLevel[key] === levels[i][key]) {
                linkStyle.textDecoration = 'underline'
                selectedIndex = i;
            }
        }

        // Level completed
        levelComplete = props.player?.completedLevels[levels[i].deployedAddress] > 0

        const isMissingSVGImage = !imagePaths.includes(`../../public/imgs/Level${levels[i].deployId}.svg`);
        const isMissingPNGImage = !imagePaths.includes(`../../public/imgs/Level${levels[i].deployId}.png`);
        var object = {
            name: levels[i].name,
            src: isMissingSVGImage && isMissingPNGImage ? (
                source !== 'mosaic' ?
                    `../../imgs/BigDefault.svg` :
                    `../../imgs/Default.svg`
            ) : (
                isMissingPNGImage ? (
                    source !== 'mosaic' ?
                    `../../imgs/BigLevel${levels[i].deployId}.svg` :
                    `../../imgs/Level${levels[i].deployId}.svg`
                ) : (
                    source !== 'mosaic' ?
                    `../../imgs/BigLevel${levels[i].deployId}.png` :
                    `../../imgs/Level${levels[i].deployId}.png`
                )
                
            ),
            difficulty: difficulty,
            deployedAddress: levels[i].deployedAddress,
            completed: levelComplete,
            id: levels[i].deployId,
            creationDate: levels[i].created
        }

        levelData.push(object);
    }

    return [levelData, levelData[selectedIndex]];
}

export default getlevelsdata
