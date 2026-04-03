# Consensus Recommendation for Campus-Level Course Registration Ledger

## Recommended Algorithm

Use **IBFT-style Proof of Authority (PoA)** consensus on a permissioned blockchain network.

## Why It Fits Campus Environments

1. **Permissioned governance**
   - Universities have clearly identified authorities (Registrar, IT security, department administration).
   - Validator membership can be restricted to trusted institutional nodes.

2. **Fast finality during peak registration**
   - Registration windows demand low-latency confirmations.
   - IBFT-style consensus provides near-instant finality compared with probabilistic finality in public chains.

3. **Byzantine fault tolerance**
   - Even if some validator nodes fail or act maliciously, the network can maintain integrity as long as a supermajority remains honest.

4. **Energy/cost efficiency**
   - No mining race, lower infrastructure cost, and predictable operations for campus budgets.

5. **Compliance and auditability**
   - Every add/drop/capacity update remains verifiable on-chain.
   - Permissioning supports policy-based node operation and easier institutional audits.

## Suggested Validator Set

- Registrar Office Node
- University IT Governance Node
- School/Faculty Administration Nodes (2+)
- Optional Disaster Recovery Node

## Operational Notes

- Maintain validator keys with HSM-backed custody where possible.
- Define incident response for validator key compromise.
- Apply scheduled governance reviews for validator rotation and policy updates.
