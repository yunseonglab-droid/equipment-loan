import { loadState, saveState } from "./domain.js";
// All demo mutations re-read the latest state. Web Locks serialize concurrent tabs.
export async function mutateStore(action) {
  const run = () => {
    const result = action(loadState());
    if (result.state) saveState(result.state);
    return result;
  };
  return navigator.locks
    ? navigator.locks.request("equipment-loan:write", run)
    : run();
}
