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
    title: 'Solana Breakout Hackathon v0',
    items: [
      { text: 'MVP Point of Sale on devnet', completed: true },
      { text: 'Multi-platform, offline-capable bespoke front end', completed: true },
      // Personnel
      { text: 'Founder, CEO', completed: true },
      { text: 'Co-Founder, CPO/HoP', completed: true },
    ],
    active: true,
  },
  {
    number: 2,
    title: 'Road to Mainnet v1',
    items: [
      // Product
      { text: 'Multi-asset Point of Sale', completed: false },
      { text: 'Send funds with whitelist', completed: false },
      { text: 'Off-ramp', completed: true },
      // { text: 'Integrate Jupiter Swap API for USDC to Perena USD* swap on main net (our first in-app DeFi yield opportunity, front-end integration only)', completed: true },
      { text: 'Rain', completed: false },
      // { text: 'Onboard Merchants 20+', completed: false },
      {text: 'Audit', completed: false },
      // Personnel
      { text: 'Lead Engineer', completed: false },
      { text: '2-man Dev Team 1', completed: false },
      { text: '2-5 Sales', completed: false },
      { text: 'CFO', completed: false },
      { text: 'CLO', completed: false },
    ],
    active: true,
  },
  {
    number: 3,
    title: 'Mainnet v2',
    items: [
      // Product
      { text: 'Existing Point of Sale integrations', completed: false },
      { text: 'Bookeeping', completed: false },
      { text: 'Perena', completed: false },
      { text: 'Jupiter API', completed: false },
      { text: 'Audit', completed: false },
      // Personnel
      { text: '2-3-man Dev Team 2', completed: false },
      { text: 'More Sales', completed: false },
    ],
    active: true,
  },
  {
    number: 3,
    title: 'Mainnet v3',
    items: [
      // Product
      { text: 'Inventory Management', completed: false },
      { text: 'Payroll', completed: false },
      { text: 'CRM', completed: false },
      { text: 'Audits', completed: false },
      // Personnel
    ],
    active: true,
  },
];

export function RoadmapPhases() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-12 hero-gradient-text">Project Roadmap and Phases</h1>
      <div className="flex flex-col lg:flex-row gap-8 justify-between">
        {phases.map((phase, index) => (
          <div
            key={`${phase.number}-${index}`}
            className={`card flex-1 p-6 ${phase.active ? 'border-mint/50' : 'opacity-50'
              }`}
          >
            <div className="mb-4">
              <div className="h-1 w-full bg-mint mb-4"></div>
              <h2 className="text-xl font-semibold mb-2">Phase {phase.number}</h2>
              <h3 className="text-lg text-mint mb-4">{phase.title}</h3>
            </div>
            <ul className="space-y-3">
              {phase.items.map((item, itemIndex) => {
                // Detect if this is the start of a personnel section by looking for personnel-related terms
                const personnelTerms = ['Engineer', 'Sales', 'CFO', 'CLO', 'CPO', 'CEO', 'Founder', 'Co-Founder', 'Dev Team', 'Support Staff', 'Team'];
                const isPersonnelItem = personnelTerms.some(term => 
                  item.text.includes(term)
                );
                
                // Check if this is the first personnel item (no previous personnel items before this one)
                const previousItems = phase.items.slice(0, itemIndex);
                const hasPreviousPersonnelItems = previousItems.some(prevItem => 
                  personnelTerms.some(term => prevItem.text.includes(term))
                );
                
                const isPersonnelStart = isPersonnelItem && !hasPreviousPersonnelItems && item.text.trim() !== '';
                
                return (
                  <React.Fragment key={itemIndex}>
                    {isPersonnelStart && (
                      <li className="py-2">
                        <div className="h-px w-full bg-mint opacity-50"></div>
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <span className={`text-2xl ${item.completed ? 'text-mint' : 'text-gray-400'}`}>
                        {item.completed ? '✓' : '○'}
                      </span>
                      <span>{item.text}</span>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
} 