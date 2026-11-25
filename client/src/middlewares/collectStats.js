import * as actions from '../actions';
import { getPublicClient } from '../utils/ethutil';

let queuedAction;

const collectStats = store => next => action => {
  if(action.type !== actions.COLLECT_STATS) {
    if(queuedAction && action.type === actions.LOAD_ETHERNAUT_CONTRACT && action.contract) {
      // console.log(`RETRIGGER`)
      next(action)
      store.dispatch(queuedAction)
      queuedAction = null
      return
    }
    return next(action)
  }

  const state = store.getState()
  // console.log(`TRY COLLECT_STATS >`, state.contracts.ethernaut !== undefined)
  if(
    !state.network.isConnected ||
    !state.contracts.ethernaut
  ) {
    if(!queuedAction) queuedAction = action
    return
  }

  const { address, abi } = state.contracts.ethernaut
  const getLogs = eventName => getPublicClient().getContractEvents({
    address,
    abi,
    eventName,
    fromBlock: 0n,
    toBlock: 'latest'
  })

  // Get Level created
  if(!action.createdInstanceLogs) {
    getLogs('LevelInstanceCreatedLog').then(logs => {
      action.createdInstanceLogs = logs
      store.dispatch(action)
    }).catch(console.log)
  }

  // Level completed
  if(!action.completedLevelLogs) {
    getLogs('LevelCompletedLog').then(logs => {
      action.completedLevelLogs = logs
      store.dispatch(action)
    }).catch(console.log)
  }

  next(action)
}

export default collectStats