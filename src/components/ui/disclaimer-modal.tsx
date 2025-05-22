'use client';

interface DisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DisclaimerModal({ isOpen, onClose }: DisclaimerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl">
        <h2 className="text-xl font-semibold mb-4">
          Disclaimer
        </h2>

        <div className="space-y-4">
          <p className="text-gray-600">
            Welcome to GotSOL. Please read this disclaimer carefully.
          </p>

          <div className="space-y-2 text-sm text-gray-600">
            <p>• As the developers of this application, we proclaim to be acting in good faith in its development and execution.</p>
            <p>• We, the developers of this application, and our wallet provider, Para, do not have access to your wallet&apos;s private keys, nor your funds, and have no admin priveleges over your assets of any kind.</p>
            <p>• The code used in this application is NOT AUDITED. Use it at your own risk.</p>
            {/* <p>• The Jupiter Terminal, in the <em>Swap</em> tab, is connected to MAINNET and you are using REAL TOKENS and REAL MONEY if you use this interface to swap.</p> */}
            <p>• The front-end user interface is not audited. The on-chain Anchor program the application is built on is not audited. They were created with care, but unknown vulnerabilties may still exist.</p>
            {/* <p>• Your use of the application with any real mainnet funds is entirely of your own volition, and we do not accept liability for any lost funds as a result of you using this application.</p> */}
            {/* <p>• We may use referral codes in our Perena USD* integration, or implement additional fees (0.001%-0.01% max) in the Jupiter Terminal that benefit us directly if you use these features within our application.</p> */}
            {/* <p>• Any non-referral-based points (Petals by Perena) we receive as a result of user activity during the course of Perena&apos;s points farming period and prospective airdrop will be passed directly on to the users who created them (if not automatically done so already by Perena).</p> */}
            {/* <p>• We will keep any referral-based points we generate as a result of the use of our referral code or our own USD* token balance. Our points are ours, and your points are yours.</p> */}
            <p>• You agree not to use this platform for illegal or unlawful purposes.</p>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 