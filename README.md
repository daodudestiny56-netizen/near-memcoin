# MIRA

**A memecoin with a point.**

MIRA is a NEAR Hackathon prototype for the **Memecoins With Mechanics** track. The token is designed around a visible community loop: people stake MIRA to enter quests, submit proof, and either earn from the reward pool or burn their stake. Participation changes supply instead of treating the meme as a passive ticker.

## Current prototype

- Quest dashboard with live progress, reward pools, and participant counts
- Demo wallet connection state
- Quest staking flow with escrow/burn copy
- Community leaderboard and mechanic explainer
- Responsive layout for a short product demo

The current UI uses deterministic demo data. NEAR testnet wallet and contract calls are the next integration step.

## Run locally

```bash
npm install
npm run dev
```

Validate a production build with:

```bash
npm run build
npm run lint
```

## Planned contract model

The on-chain quest contract will own the following state:

1. Quest metadata, stake amount, deadline, and reward pool
2. One participation receipt per account and quest
3. Organizer resolution with proof links and winner accounts
4. Automatic winner payouts and failed-stake burns
5. Treasury accounting and transparent supply events

The prototype deliberately keeps the rules simple enough to explain in a two-minute demo and extensible enough to support NEAR Intents or a token contract later.
