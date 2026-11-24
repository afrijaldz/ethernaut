// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import {Utils} from "test/utils/Utils.sol";

import {DoubleEntryPoint, Forta} from "src/levels/DoubleEntryPoint.sol";
import {DoubleEntryPointFactory} from "src/levels/DoubleEntryPointFactory.sol";
import {DetectionBot} from "src/attacks/DetectionBot.sol";
import {Level} from "src/levels/base/Level.sol";
import {Ethernaut} from "src/Ethernaut.sol";

/// @notice A bot that raises an alert on every transaction, so it blocks every delegateTransfer.
contract AlwaysAlertBot {
    Forta forta;

    constructor(Forta _forta) {
        forta = _forta;
    }

    function handleTransaction(address user, bytes calldata) external {
        forta.raiseAlert(user);
    }
}

contract TestDoubleEntryPoint is Test, Utils {
    Ethernaut ethernaut;
    DoubleEntryPoint instance;

    address payable owner;
    address payable player;

    /*//////////////////////////////////////////////////////////////
                                 HELPERS
    //////////////////////////////////////////////////////////////*/

    function setUp() public {
        address payable[] memory users = createUsers(2);

        owner = users[0];
        vm.label(owner, "Owner");

        player = users[1];
        vm.label(player, "Player");

        vm.startPrank(owner);
        ethernaut = getEthernautWithStatsProxy(owner);
        DoubleEntryPointFactory factory = new DoubleEntryPointFactory();
        ethernaut.registerLevel(Level(address(factory)));
        vm.stopPrank();

        vm.startPrank(player);
        instance = DoubleEntryPoint(payable(createLevelInstance(ethernaut, Level(address(factory)), 0)));
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                                 TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Check the initial state of the level and environment.
    function testInit() public {
        vm.startPrank(player);
        assertFalse(submitLevelInstance(ethernaut, address(instance)));
    }

    /// @notice Test the solution for the level.
    function testSolve() public {
        vm.startPrank(player);

        Forta forta = instance.forta();
        address cryptoVault = instance.cryptoVault();
        DetectionBot bot = new DetectionBot(address(forta), cryptoVault);

        forta.setDetectionBot(address(bot));

        assertTrue(submitLevelInstance(ethernaut, address(instance)));
    }

    /// @notice A bot that blocks every transfer, not only the sweep, must fail the level.
    function testAlwaysAlertBotFails() public {
        vm.startPrank(player);

        Forta forta = instance.forta();
        AlwaysAlertBot bot = new AlwaysAlertBot(forta);

        forta.setDetectionBot(address(bot));

        assertFalse(submitLevelInstance(ethernaut, address(instance)));
    }
}
