'use client';

import React from 'react';

interface Phase {
  number: number;
  title: string;
  items: {
    text: string;
    completed: boolean;
  }[];
  active: boolean;
}

const phases: Phase[] = [
  {
    number: 1,
    title: 'Solana Breakout Hackathon v0)',
    items: [
      { text: 'MVP Point of Sale on devnet', completed: true },
    ],
    active: true,
  },
  {
    number: 2,
    title: 'Mainnet v1)',
    items: [
      { text: 'Multi-asset Point of Sale)', completed: true },
      { text: 'Multi-platform, offline-capable bespoke front end', completed: true },
      { text: 'USD Off-ramp', completed: true },
      // { text: 'Integrate Jupiter Swap API for USDC to Perena USD* swap on main net (our first in-app DeFi yield opportunity, front-end integration only)', completed: true },
      { text: 'Send funds with whitelist', completed: true },
      { text: 'Onboard Merchants 20+', completed: false },
      { text: 'Audit', completed: false },
    ],
    active: true,
  },
  {
    number: 3,
    title: 'Mainnet v2)',
    items: [
      { text: 'Existing Point of Sale integrations)', completed: false },
      { text: 'Rain stable-cards', completed: false },
      { text: 'Inventory Management)', completed: false },
      { text: 'Bookeeping', completed: false },
      { text: 'Payroll', completed: false },
      { text: 'Perena)', completed: false },
      { text: 'Jupiter API)', completed: false },
      { text: 'Audits', completed: false },
    ],
    active: true,
  },
  {
    number: 4,
    title: 'Mainnet v3',
    items: [
    ],
    active: true,
  },
  {
    number: 5,
    title: 'Integrate Merchant and Customer Feedback, start building stretch goals v2',
    items: [
      { text: 'Build Treasury and Yield opportunities for the Merchant (requires Anchor CPI integrations so Merchant PDAs can sign)', completed: false },
      { text: 'Build Automated Tax and Revenue payments/compliance', completed: false },
      { text: 'Onboard tax and revenue bureaus for interested government parties', completed: false },
      { text: 'Build the capacity for AI-driven marketing campaigns for Merchants to drive local business, all within our app B-to-C', completed: false },
    ],
    active: true,
  },
];

export function RoadmapPhases() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-12 hero-gradient-text">Project Roadmap and Phases</h1>
      <div className="flex flex-col lg:flex-row gap-8 justify-between">
        {phases.map((phase) => (
          <div
            key={phase.number}
            className={`card flex-1 p-6 ${phase.active ? 'border-mint/50' : 'opacity-50'
              }`}
          >
            <div className="mb-4">
              <div className="h-1 w-full bg-mint mb-4"></div>
              <h2 className="text-xl font-semibold mb-2">Phase {phase.number}</h2>
              <h3 className="text-lg text-mint mb-4">{phase.title}</h3>
            </div>
            <ul className="space-y-3">
              {phase.items.map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className={`text-2xl ${item.completed ? 'text-mint' : 'text-gray-400'}`}>
                    {item.completed ? '✓' : '○'}
                  </span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
} 