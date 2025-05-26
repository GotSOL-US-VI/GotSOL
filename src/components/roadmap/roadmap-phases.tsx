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
      { text: 'Write Anchor backend; achieve a working Merchant Point of Sale program', completed: true },
      { text: 'Deploy Anchor program to Solana devnet', completed: true },
      { text: 'Deploy a working front-end Vercel web app', completed: true },
      { text: 'Integrate Para MPC wallet provider for key-less user wallets via social sign-on', completed: true },
      { text: 'Integrate gas fee-payer accounts for Merchants and their customers on devnet (1/2 completed)', completed: true },
      { text: 'Conduct User Experience Surveys and solicit user feedback', completed: true }
    ],
    active: true,
  },
  {
    number: 2,
    title: 'Prepare Program for Mainnet Launch with MVP version v1)',
    items: [
      { text: 'Trim the Anchor program to acceptable MVP levels (Merchant Point of Sale, 8 stablecoin options)', completed: false },
      { text: 'Full-stack security audit', completed: false },
      { text: 'Create video and text resources for Merchants and users on how to use the application', completed: false },
      // { text: 'Integrate Jupiter Swap API for USDC to Perena USD* swap on main net (our first in-app DeFi yield opportunity, front-end integration only)', completed: true },
      { text: 'Register GotSOL trade name in USVI', completed: true },
      { text: 'Onboard interested Merchants in-person in the US Virgin Islands (20+ Verbal commitments)', completed: true },
    ],
    active: true,
  },
  {
    number: 3,
    title: 'Onboard Merchants, Extend offerings v1.5)',
    items: [
      { text: 'Build mobile iOS and Android apps for Merchants, compatible with existing point of sale hardware if possible', completed: false },
      { text: 'Build Merchant Inventory Management System (Off-chain solution)', completed: false },
      { text: 'Integrate Bookkeeping services for Merchants (Quickbooks, Xero)', completed: false },
      { text: 'Build in-app Payroll Services for Merchants', completed: false },
      { text: 'Continuous auditing backend and front-end integrations', completed: false },
    ],
    active: true,
  },
  {
    number: 4,
    title: 'Focus on Customer On-boarding (end Customers, not Merchants v1.5.5)',
    items: [
      { text: 'Build mobile app for customers focusing on quality DeFi opportunities', completed: false },
      { text: 'On-board customers to our app using social sign-on, DeFi, and gas-less transactions', completed: false },
      { text: 'Expand customer DeFi suite with stablecoin, SOL, and BTC yield opportunities (the simpler the better)', completed: false },
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