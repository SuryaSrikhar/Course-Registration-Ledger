import { ethers } from "ethers";

// Paste the Remix deployed contract address here.
export const CONTRACT_ADDRESS = "PASTE_REMIX_CONTRACT_ADDRESS_HERE";

// Paste the full ABI JSON array from Remix here.
export const CONTRACT_ABI = [];

export function isFrontendContractConfigured() {
  return (
    ethers.isAddress(CONTRACT_ADDRESS) &&
    Array.isArray(CONTRACT_ABI) &&
    CONTRACT_ABI.length > 0
  );
}
